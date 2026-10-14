import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import sequelize from "../../database";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import { applySubscriptionRenewal } from "./applySubscriptionRenewal";
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
};

/**
 * Confirma pagamento externo verificável (webhook após consulta ao gateway).
 * Idempotente por externalTxid ou invoice já paid + mesmo txid.
 */
export async function confirmGatewayPayment(
  input: ConfirmGatewayPaymentInput
): Promise<{ payment: SaaSPayment; renewed: boolean; alreadyApplied: boolean }> {
  return sequelize.transaction(async (t: Transaction) => {
    if (input.externalTxid) {
      const byTxid = await SaaSPayment.findOne({
        where: { externalTxid: input.externalTxid },
        transaction: t
      });
      if (byTxid) {
        return { payment: byTxid, renewed: false, alreadyApplied: true };
      }
    }

    const invoice = await Invoices.findByPk(input.invoiceId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

    if (String(invoice.status).toLowerCase() === "paid") {
      if (
        input.externalTxid &&
        invoice.externalTxid &&
        invoice.externalTxid === input.externalTxid
      ) {
        const existing = await SaaSPayment.findOne({
          where: { invoiceId: invoice.id },
          transaction: t,
          order: [["id", "DESC"]]
        });
        if (existing) {
          return { payment: existing, renewed: false, alreadyApplied: true };
        }
      }
      // Já paga por outro meio — não renovar de novo
      const existing = await SaaSPayment.findOne({
        where: { invoiceId: invoice.id },
        transaction: t,
        order: [["id", "DESC"]]
      });
      if (existing) {
        return { payment: existing, renewed: false, alreadyApplied: true };
      }
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
      const renewResult = await applySubscriptionRenewal({
        companyId: invoice.companyId,
        reason: "payment_confirmed",
        invoiceId: invoice.id,
        paymentId: payment.id,
        idempotencyKey: `renew:${idempotencyKey}`,
        transaction: t
      });
      renewed = !renewResult.alreadyApplied;
    }

    return { payment, renewed, alreadyApplied: false };
  }).then(async result => {
    if (!result.alreadyApplied) {
      try {
        const company = await Company.findByPk(result.payment.companyId);
        const io = getIO();
        io.to(`company-${result.payment.companyId}-mainchannel`).emit(
          `company-${result.payment.companyId}-payment`,
          { action: "paid", company }
        );
      } catch (err) {
        logger.warn({ err }, "[SaasBilling] socket_emit_failed");
      }
    }
    return result;
  });
}
