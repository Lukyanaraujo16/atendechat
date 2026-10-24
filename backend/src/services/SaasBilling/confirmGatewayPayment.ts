import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import sequelize from "../../database";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import {
  applySubscriptionRenewal,
  ApplySubscriptionRenewalResult,
  runRenewalSideEffects
} from "./applySubscriptionRenewal";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { getIO } from "../../libs/socket";
import Company from "../../models/Company";
import { logger } from "../../utils/logger";

export type ConfirmGatewayPaymentInput = {
  invoiceId: number;
  amount: number;
  method: "pix" | "boleto" | "credit_card";
  externalTxid?: string | null;
  externalChargeId?: string | null;
  gatewayProvider?: string;
  gatewayStatus?: string;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
  /**
   * D-P6/SF-1/SF-2 (B3.3, RF3.14a): só o pipeline `async` passa este parâmetro. Sem ele, o
   * comportamento da 8.4 é mantido integralmente (T-ACT-06).
   */
  cancelledInvoicePolicy?: "receive_for_reconciliation";
};

export type ConfirmGatewayPaymentResult = {
  /** null apenas quando a fatura já estava quitada sem nenhum SaaSPayment (legado) — ver conciliação. */
  payment: SaaSPayment | null;
  renewed: boolean;
  alreadyApplied: boolean;
  /** D-P6: recebimento registrado em fatura cancelada (sem receita, sem renovação). */
  cancelledInvoiceReceipt?: boolean;
  reconciliationItemId?: number | null;
};

export const GATEWAY_ON_SETTLED_KIND = "gateway_payment_on_settled_invoice";
export const GATEWAY_ON_CANCELLED_KIND = "gateway_payment_on_cancelled_invoice";

/**
 * D-P6 + SF-1 + SF-2 (B3.3): Pix confirmado para fatura cancelada.
 * - 1º txid da fatura: grava o recebimento (`SaaSPayment` gateway, `countsAsRevenue=false`,
 *   fora da receita consolidada até a conciliação), a fatura continua `cancelled`, nada é
 *   renovado e abre conciliação "pagamento em fatura cancelada".
 * - Com fatura substituta do mesmo ciclo (SF-2): mesma coisa, com a substituta identificada
 *   e `requiresManualDecision`; nada é aplicado à substituta.
 * - 2º txid da mesma fatura cancelada: só conciliação de duplicidade (um recebimento por fatura).
 * Idempotente por txid (índice único de `SaaSPayments.externalTxid`) e por fatura (lock).
 */
async function receiveOnCancelledInvoice(
  invoice: Invoices,
  input: ConfirmGatewayPaymentInput,
  t: Transaction
): Promise<ConfirmGatewayPaymentResult> {
  const txid = input.externalTxid ? String(input.externalTxid) : null;
  const replacement = invoice.cycleKey
    ? await Invoices.findOne({
        where: {
          companyId: invoice.companyId,
          cycleKey: invoice.cycleKey,
          id: { [Op.ne]: invoice.id },
          status: { [Op.ne]: "cancelled" }
        } as any,
        order: [["id", "DESC"]],
        transaction: t
      })
    : null;
  const previous = await SaaSPayment.findOne({
    where: { invoiceId: invoice.id, source: "gateway" },
    order: [["id", "ASC"]],
    transaction: t
  });

  const findItem = () =>
    SaaSReconciliationItem.findOne({
      where: {
        invoiceId: invoice.id,
        kind: GATEWAY_ON_CANCELLED_KIND,
        metadata: { externalTxid: txid }
      } as any,
      transaction: t
    });

  let payment: SaaSPayment | null = null;
  if (!previous) {
    payment = await SaaSPayment.create(
      {
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        amount: input.amount,
        method: input.method,
        source: "gateway",
        // SF-1: recebimento rastreável, fora da receita consolidada até a conciliação.
        countsAsRevenue: false,
        paidAt: input.paidAt || new Date(),
        recordedByUserId: null,
        reason: null,
        externalTxid: txid,
        externalChargeId: input.externalChargeId ?? null,
        gatewayProvider: input.gatewayProvider || "efi",
        gatewaySyncStatus: "synced",
        gatewaySyncError: null,
        metadata: {
          ...(input.metadata || {}),
          cancelledInvoiceReceipt: true,
          pendingReconciliation: true
        }
      },
      { transaction: t }
    );
  }

  const existingItem = await findItem();
  let item = existingItem;
  if (!item) {
    const duplicate = !!previous;
    const base = `a Efí confirmou o Pix ${txid ?? "(sem txid)"} (R$ ${Number(input.amount).toFixed(
      2
    )}) para a fatura #${invoice.id}, que está CANCELADA.`;
    const message = duplicate
      ? `Possível pagamento em duplicidade: ${base} A fatura já tem outro recebimento (pagamento #${previous!.id}); este Pix não foi registrado como recebimento. Verifique devolução ou crédito.`
      : `Pagamento em fatura cancelada: ${base} O recebimento foi registrado fora da receita consolidada, a fatura continua cancelada e a assinatura NÃO foi renovada.${
          replacement
            ? ` Existe a fatura substituta #${replacement.id} do mesmo ciclo: decida manualmente (nada foi aplicado a ela).`
            : " Decida: devolver, reconhecer ou aplicar manualmente."
        }`;
    item = await SaaSReconciliationItem.create(
      {
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        paymentId: payment?.id ?? previous?.id ?? null,
        kind: GATEWAY_ON_CANCELLED_KIND,
        status: "pending",
        message,
        retryCount: 0,
        lastError: null,
        metadata: {
          externalTxid: txid,
          amount: input.amount,
          method: input.method,
          gatewayProvider: input.gatewayProvider || "efi",
          gatewayPaidAt: input.paidAt ? input.paidAt.toISOString() : null,
          countsAsRevenue: false,
          renewed: false,
          duplicateOfPaymentId: previous?.id ?? null,
          replacementInvoiceId: replacement?.id ?? null,
          requiresManualDecision: true,
          gatewayMetadata: input.metadata || null
        }
      },
      { transaction: t }
    );
    await recordFinancialEvent({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      paymentId: payment?.id ?? null,
      eventType: GATEWAY_ON_CANCELLED_KIND,
      actorUserId: null,
      idempotencyKey: `evt:gw-on-cancelled:${txid ?? `invoice:${invoice.id}`}`,
      payload: {
        externalTxid: txid,
        amount: input.amount,
        countsAsRevenue: false,
        renewed: false,
        receiptRecorded: !!payment,
        replacementInvoiceId: replacement?.id ?? null,
        endToEndId: (input.metadata as any)?.endToEndId ?? null
      },
      transaction: t
    });
    logger.warn(
      {
        invoiceId: invoice.id,
        companyId: invoice.companyId,
        externalTxid: txid,
        duplicate,
        replacementInvoiceId: replacement?.id ?? null
      },
      "[SaasBilling] gateway_payment_on_cancelled_invoice"
    );
  }
  return {
    payment: payment ?? previous,
    renewed: false,
    alreadyApplied: !payment,
    cancelledInvoiceReceipt: !!payment,
    reconciliationItemId: item?.id ?? null
  };
}

/**
 * Item de conciliação "possível pagamento em duplicidade", idempotente por txid
 * (a fatura está sob lock FOR UPDATE: confirmações simultâneas serializam aqui).
 */
async function openSettledInvoiceReconciliation(
  invoice: Invoices,
  existing: SaaSPayment | null,
  input: ConfirmGatewayPaymentInput,
  t: Transaction
): Promise<void> {
  const txid = String(input.externalTxid);
  const already = await SaaSReconciliationItem.findOne({
    where: {
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      kind: GATEWAY_ON_SETTLED_KIND,
      metadata: { externalTxid: txid }
    } as any,
    transaction: t
  });
  const logPayload = {
    invoiceId: invoice.id,
    companyId: invoice.companyId,
    externalTxid: txid,
    amount: input.amount,
    settledBy: existing?.source ?? invoice.paymentSource ?? null,
    existingPaymentId: existing?.id ?? null,
    duplicateNotice: !!already
  };
  if (already) {
    logger.info(logPayload, "[SaasBilling] gateway_payment_on_settled_invoice_replay");
    return;
  }
  const settledBy = existing?.source ?? invoice.paymentSource ?? "desconhecida";
  // Fatura legada quitada sem SaaSPayment e com o mesmo txid: pode ser o próprio Pix original
  // (reentrega do webhook) — continua sem receita/renovação, mas o operador é avisado.
  const sameTxidAsInvoice = !!invoice.externalTxid && invoice.externalTxid === txid;
  const message = `Possível pagamento em duplicidade: a Efí confirmou o Pix ${txid} (R$ ${Number(
    input.amount
  ).toFixed(2)}) para a fatura #${invoice.id}, que já estava quitada (origem: ${settledBy}). Nada foi renovado nem contado como receita; verifique estorno ou crédito.${
    sameTxidAsInvoice && !existing
      ? " Atenção: é o mesmo Pix da cobrança desta fatura e não há pagamento registrado — pode ser o pagamento original de uma fatura legada."
      : ""
  }`;
  await SaaSReconciliationItem.create(
    {
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      paymentId: existing?.id ?? null,
      kind: GATEWAY_ON_SETTLED_KIND,
      status: "pending",
      message,
      retryCount: 0,
      lastError: null,
      metadata: {
        externalTxid: txid,
        externalChargeId: input.externalChargeId ?? null,
        gatewayProvider: input.gatewayProvider || "efi",
        gatewayStatus: input.gatewayStatus || null,
        amount: input.amount,
        method: input.method,
        gatewayPaidAt: input.paidAt ? input.paidAt.toISOString() : null,
        settledBySource: existing?.source ?? invoice.paymentSource ?? null,
        existingPaymentId: existing?.id ?? null,
        possibleDuplicatePayment: true,
        sameTxidAsInvoice,
        gatewayMetadata: input.metadata || null
      }
    },
    { transaction: t }
  );
  await recordFinancialEvent({
    companyId: invoice.companyId,
    invoiceId: invoice.id,
    paymentId: existing?.id ?? null,
    eventType: "gateway_payment_on_settled_invoice",
    actorUserId: null,
    idempotencyKey: `evt:gw-on-settled:${txid}`,
    payload: {
      externalTxid: txid,
      amount: input.amount,
      settledBySource: existing?.source ?? invoice.paymentSource ?? null,
      countsAsRevenue: false,
      renewed: false
    },
    transaction: t
  });
  logger.warn(logPayload, "[SaasBilling] gateway_payment_on_settled_invoice");
}

/**
 * Confirma pagamento externo verificável (webhook após consulta ao gateway).
 * Idempotente por externalTxid ou invoice já paid + mesmo txid.
 */
export async function confirmGatewayPayment(
  input: ConfirmGatewayPaymentInput
): Promise<ConfirmGatewayPaymentResult> {
  let renewResult: ApplySubscriptionRenewalResult | null = null;
  return sequelize.transaction(async (t: Transaction) => {
    if (input.externalTxid) {
      const byTxid = await SaaSPayment.findOne({
        where: { externalTxid: input.externalTxid },
        transaction: t
      });
      if (byTxid) {
        if (byTxid.source !== "gateway") {
          // A baixa manual copiou o txid da cobrança Pix e agora a Efí confirmou esse Pix (o webhook só
          // chega aqui após consultar a cobrança CONCLUIDA): o cliente pagou também pelo Pix.
          // Não renova nem duplica receita, mas abre conciliação "possível duplicidade" (idempotente).
          logger.warn(
            {
              invoiceId: byTxid.invoiceId,
              paymentId: byTxid.id,
              source: byTxid.source,
              externalTxid: input.externalTxid
            },
            "[SaasBilling] gateway_confirmation_matches_non_gateway_payment"
          );
          const settledInvoice = byTxid.invoiceId
            ? await Invoices.findByPk(byTxid.invoiceId, {
                transaction: t,
                lock: t.LOCK.UPDATE
              })
            : null;
          if (settledInvoice) {
            await openSettledInvoiceReconciliation(settledInvoice, byTxid, input, t);
          }
        }
        return { payment: byTxid, renewed: false, alreadyApplied: true };
      }
    }

    const invoice = await Invoices.findByPk(input.invoiceId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

    if (
      input.cancelledInvoicePolicy === "receive_for_reconciliation" &&
      String(invoice.status).toLowerCase() === "cancelled"
    ) {
      return receiveOnCancelledInvoice(invoice, input, t);
    }

    if (String(invoice.status).toLowerCase() === "paid") {
      if (input.externalTxid) {
        // Rechecagem sob o lock da fatura: uma confirmação simultânea do MESMO txid pode ter
        // acabado de commitar (não é duplicidade, é replay).
        const sameTxid = await SaaSPayment.findOne({
          where: { externalTxid: input.externalTxid },
          transaction: t
        });
        if (sameTxid) {
          return { payment: sameTxid, renewed: false, alreadyApplied: true };
        }
      }
      const existing = await SaaSPayment.findOne({
        where: { invoiceId: invoice.id },
        transaction: t,
        order: [["id", "DESC"]]
      });
      // F6/F-D5: a fatura já está quitada e ESTE txid não tem SaaSPayment (a checagem por txid acima
      // falhou): o dinheiro chegou pela Efí para uma fatura quitada por outra fonte (manual, histórica,
      // cortesia, legado ou outra cobrança). Não renova, não cria receita: abre conciliação.
      if (input.externalTxid) {
        await openSettledInvoiceReconciliation(invoice, existing, input, t);
      } else if (!existing) {
        logger.warn(
          { invoiceId: invoice.id },
          "[SaasBilling] gateway_payment_on_paid_invoice_without_txid"
        );
      }
      return { payment: existing, renewed: false, alreadyApplied: true };
    }

    const expected = Number(invoice.value);
    if (Math.round(expected * 100) !== Math.round(input.amount * 100)) {
      throw new AppError("ERR_PAYMENT_AMOUNT_MISMATCH", 400);
    }

    const paidAt = input.paidAt || new Date();
    const idempotencyKey = input.externalTxid
      ? `gw-pay:${input.externalTxid}`
      : `gw-pay:invoice:${invoice.id}`;

    const payment = await SaaSPayment.create(
      {
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        amount: input.amount,
        method: input.method,
        source: "gateway",
        countsAsRevenue: true,
        paidAt,
        recordedByUserId: null,
        reason: null,
        externalTxid: input.externalTxid ?? null,
        externalChargeId: input.externalChargeId ?? null,
        gatewayProvider: input.gatewayProvider || "efi",
        gatewaySyncStatus: "synced",
        gatewaySyncError: null,
        metadata: input.metadata || null
      },
      { transaction: t }
    );

    await invoice.update(
      {
        status: "paid",
        paidAt,
        paymentSource: "gateway",
        externalTxid: input.externalTxid ?? invoice.externalTxid,
        externalChargeId: input.externalChargeId ?? invoice.externalChargeId,
        gatewayProvider: input.gatewayProvider || "efi",
        gatewayStatus: input.gatewayStatus || "CONCLUIDA",
        gatewaySyncStatus: "synced",
        legacyUnknown: false
      },
      { transaction: t }
    );

    await recordFinancialEvent({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      eventType: "payment_confirmed_gateway",
      actorUserId: null,
      idempotencyKey: `evt:${idempotencyKey}`,
      payload: {
        method: input.method,
        externalTxid: input.externalTxid,
        amount: input.amount
      },
      transaction: t
    });

    let renewed = false;
    if (saasBillingFlags.autoRenewOnPayment()) {
      // Mesma chave da baixa manual: uma renovação por fatura.
      try {
        renewResult = await applySubscriptionRenewal({
          companyId: invoice.companyId,
          reason: "payment_confirmed",
          invoiceId: invoice.id,
          paymentId: payment.id,
          idempotencyKey: `renew-invoice:${invoice.id}`,
          coversInvoiceDueDate: invoice.dueDate,
          transaction: t
        });
        renewed = !!renewResult.renewal && !renewResult.alreadyApplied;
      } catch (err: any) {
        // Erro determinístico de cadastro (recorrência inválida), lançado pelo planner ANTES de qualquer
        // escrita: reverter tudo faria a Efí reenviar para sempre e o Pix recebido nunca seria registrado.
        // Registra o pagamento e pede ação do operador via conciliação.
        if (!(err instanceof AppError) || err.message !== "ERR_INVALID_RECURRENCE") throw err;
        renewResult = null;
        await SaaSReconciliationItem.create(
          {
            companyId: invoice.companyId,
            invoiceId: invoice.id,
            paymentId: payment.id,
            kind: "gateway_payment_renewal_failed",
            status: "pending",
            message:
              "Pix recebido e registrado, mas a assinatura NÃO foi renovada: a recorrência da empresa é inválida. Corrija a recorrência e renove administrativamente.",
            retryCount: 0,
            lastError: err.message,
            metadata: { externalTxid: input.externalTxid ?? null }
          },
          { transaction: t }
        );
        logger.warn(
          { invoiceId: invoice.id, companyId: invoice.companyId },
          "[SaasBilling] gateway_payment_renewal_failed"
        );
      }
    }

    return { payment, renewed, alreadyApplied: false };
  }).then(async result => {
    if (renewResult) {
      await runRenewalSideEffects({ reason: "payment_confirmed" }, renewResult);
    }
    if (!result.alreadyApplied && result.payment && !result.cancelledInvoiceReceipt) {
      try {
        // A sala chega a todos os usuários da empresa: só o que os consumidores usam (sem internalNotes etc.).
        const company = await Company.findByPk(result.payment.companyId, {
          attributes: ["id", "dueDate", "status"]
        });
        const io = getIO();
        io.to(`company-${result.payment.companyId}-mainchannel`).emit(
          `company-${result.payment.companyId}-payment`,
          {
            action: "paid",
            company: company
              ? { id: company.id, dueDate: company.dueDate, status: company.status }
              : null
          }
        );
      } catch (err) {
        logger.warn({ err }, "[SaasBilling] socket_emit_failed");
      }
    }
    return result;
  });
}
