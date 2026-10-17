import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import sequelize from "../../database";
import { recordFinancialEvent } from "./recordFinancialEvent";

/**
 * Núcleo do cancelamento (soft) de uma fatura JÁ travada (FOR UPDATE) na transação do chamador.
 * Mesma semântica usada por `cancelSaasInvoice` e pela regularização histórica (improper_cancel):
 * status "cancelled" + cancelledAt; paga → 400; com pagamento → 409; já cancelada → sem efeito.
 * Retorna `cancelled=false` quando a fatura já estava cancelada (idempotente, sem ledger).
 */
export async function cancelLockedInvoice(input: {
  invoice: Invoices;
  companyId: number;
  actorUserId: number;
  reason: string;
  transaction: Transaction;
  eventType?: string;
  extraPayload?: Record<string, unknown>;
}): Promise<{ invoice: Invoices; cancelled: boolean }> {
  const { invoice, transaction: t } = input;
  const status = String(invoice.status).toLowerCase();
  if (status === "paid") {
    throw new AppError(
      "ERR_CANNOT_CANCEL_PAID_INVOICE",
      400,
      "Esta fatura já foi paga e não pode ser cancelada. Atualize a página."
    );
  }
  if (status === "cancelled") {
    return { invoice, cancelled: false };
  }

  const paymentsCount = await SaaSPayment.count({
    where: { invoiceId: invoice.id, companyId: input.companyId },
    transaction: t
  });
  if (paymentsCount > 0) {
    throw new AppError(
      "ERR_CANNOT_CANCEL_INVOICE_WITH_PAYMENT",
      409,
      "Fatura com pagamento registrado não pode ser cancelada."
    );
  }

  const before = {
    status: invoice.status,
    cancelledAt: invoice.cancelledAt ?? null
  };
  const cancelledAt = new Date();

  await invoice.update(
    {
      status: "cancelled",
      cancelledAt
    },
    { transaction: t }
  );

  await recordFinancialEvent({
    companyId: invoice.companyId,
    invoiceId: invoice.id,
    eventType: input.eventType || "invoice_cancelled",
    actorUserId: input.actorUserId,
    payload: {
      reason: input.reason,
      before,
      after: { status: "cancelled", cancelledAt: cancelledAt.toISOString() },
      externalChargeActive: !!(invoice.externalTxid || invoice.externalChargeId),
      externalTxid: invoice.externalTxid ?? null,
      externalChargeId: invoice.externalChargeId ?? null,
      ...(input.extraPayload || {})
    },
    transaction: t
  });

  await invoice.reload({ transaction: t });
  return { invoice, cancelled: true };
}

/**
 * Cancela fatura SaaS (soft): status "cancelled" + cancelledAt. Nunca exclui o registro.
 * Não cancela cobrança na Efí — se houver cobrança externa ativa, isso fica registrado no ledger.
 */
export async function cancelSaasInvoice(input: {
  invoiceId: number;
  companyId: number;
  actorUserId: number;
  reason: string;
}): Promise<Invoices> {
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) {
    throw new AppError(
      "ERR_CANCEL_REASON_REQUIRED",
      400,
      "Informe a justificativa do cancelamento."
    );
  }

  return sequelize.transaction(async t => {
    const invoice = await Invoices.findOne({
      where: { id: input.invoiceId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

    const result = await cancelLockedInvoice({
      invoice,
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      reason,
      transaction: t
    });
    return result.invoice;
  });
}
