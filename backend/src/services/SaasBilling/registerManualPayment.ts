import AppError from "../../errors/AppError";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import sequelize from "../../database";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import { applySubscriptionRenewal } from "./applySubscriptionRenewal";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { settleEfiCobrancasCharge } from "./efiCobrancasClient";
import { logger } from "../../utils/logger";

export type ManualPaymentKind = "paid_offline" | "courtesy";

export type RegisterManualPaymentInput = {
  invoiceId: number;
  companyId: number;
  actorUserId: number;
  kind: ManualPaymentKind;
  amount: number;
  method: string;
  paidAt: Date;
  reason: string;
  renewSubscription?: boolean;
};

/**
 * Baixa manual Super Admin.
 * Cortesia: countsAsRevenue=false.
 * Pix: nunca simula CONCLUIDA; se houver charge Cobranças, tenta settle se flag ON.
 */
export async function registerManualPayment(
  input: RegisterManualPaymentInput
): Promise<{
  payment: SaaSPayment;
  invoice: Invoices;
  gatewaySyncStatus: string;
  renewed: boolean;
}> {
  if (!input.reason || !String(input.reason).trim()) {
    throw new AppError("ERR_MANUAL_PAYMENT_REASON_REQUIRED", 400);
  }

  return sequelize.transaction(async t => {
    const invoice = await Invoices.findOne({
      where: { id: input.invoiceId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

    const status = String(invoice.status).toLowerCase();
    if (status === "paid" || status === "cancelled") {
      throw new AppError("ERR_INVOICE_NOT_OPEN", 400);
    }

    const isCourtesy = input.kind === "courtesy";
    const countsAsRevenue = !isCourtesy;
    const paymentSource = isCourtesy ? "courtesy" : "paid_offline";

    let gatewaySyncStatus = "none";
    let gatewaySyncError: string | null = null;

    // Tentativa de settle apenas para API Cobranças (boleto/cartão), nunca Pix
    const canSettle =
      saasBillingFlags.cobrancasSettleEnabled() &&
      !!invoice.externalChargeId &&
      (invoice.gatewayProvider === "efi_cobrancas" ||
        String(invoice.gatewayProvider || "").includes("cobrancas"));

    if (canSettle && !isCourtesy) {
      try {
        await settleEfiCobrancasCharge(String(invoice.externalChargeId));
        gatewaySyncStatus = "synced";
      } catch (err: any) {
        gatewaySyncStatus = "failed";
        gatewaySyncError = err?.message || String(err);
        logger.warn(
          { err, invoiceId: invoice.id },
          "[SaasBilling] efi_settle_failed"
        );
      }
    } else if (
      invoice.externalTxid &&
      (invoice.gatewayProvider === "efi" ||
        invoice.gatewayProvider === "gerencianet")
    ) {
      // Pix: baixa manual externa não suportada oficialmente
      gatewaySyncStatus = "unsupported";
      gatewaySyncError =
        "Pix não possui operação oficial de marcar como pago manualmente. Baixa apenas local; status externo preservado.";
    } else if (invoice.externalChargeId && !canSettle) {
      gatewaySyncStatus = "pending";
      gatewaySyncError =
        "Settle Cobranças desabilitado (EFI_COBRANCAS_SETTLE_ENABLED). Baixa local registrada; conciliar externamente.";
    }

    const payment = await SaaSPayment.create(
      {
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        amount: input.amount,
        method: input.method,
        source: paymentSource,
        countsAsRevenue,
        paidAt: input.paidAt,
        recordedByUserId: input.actorUserId,
        reason: input.reason.trim(),
        externalTxid: invoice.externalTxid,
        externalChargeId: invoice.externalChargeId,
        gatewayProvider: invoice.gatewayProvider,
        gatewaySyncStatus,
        gatewaySyncError,
        metadata: { kind: input.kind }
      },
      { transaction: t }
    );

    await invoice.update(
      {
        status: "paid",
        paidAt: input.paidAt,
        paymentSource,
        gatewaySyncStatus,
        gatewaySyncError,
        legacyUnknown: false
      },
      { transaction: t }
    );

    await recordFinancialEvent({
      companyId: invoice.companyId,
      invoiceId: invoice.id,
      paymentId: payment.id,
      eventType: isCourtesy ? "courtesy_granted" : "manual_payment_recorded",
      actorUserId: input.actorUserId,
      idempotencyKey: `manual:${invoice.id}:${payment.id}`,
      payload: {
        kind: input.kind,
        amount: input.amount,
        method: input.method,
        reason: input.reason,
        gatewaySyncStatus,
        countsAsRevenue
      },
      transaction: t
    });

    if (
      gatewaySyncStatus === "failed" ||
      gatewaySyncStatus === "unsupported" ||
      gatewaySyncStatus === "pending"
    ) {
      await SaaSReconciliationItem.create(
        {
          companyId: invoice.companyId,
          invoiceId: invoice.id,
          paymentId: payment.id,
          kind:
            gatewaySyncStatus === "unsupported"
              ? "manual_pix_no_settle"
              : "manual_settle_divergence",
          status: "pending",
          message: gatewaySyncError,
          retryCount: 0,
          lastError: gatewaySyncError,
          metadata: {
            gatewaySyncStatus,
            externalTxid: invoice.externalTxid,
            externalChargeId: invoice.externalChargeId
          }
        },
        { transaction: t }
      );
    }

    const shouldRenew =
      input.renewSubscription !== false &&
      (isCourtesy || input.kind === "paid_offline");

    let renewed = false;
    if (shouldRenew) {
      const renewResult = await applySubscriptionRenewal({
        companyId: invoice.companyId,
        reason: isCourtesy ? "courtesy" : "payment_confirmed",
        actorUserId: input.actorUserId,
        invoiceId: invoice.id,
        paymentId: payment.id,
        idempotencyKey: `renew-manual:${invoice.id}:${payment.id}`,
        transaction: t
      });
      renewed = !renewResult.alreadyApplied;
    }

    await invoice.reload({ transaction: t });
    return { payment, invoice, gatewaySyncStatus, renewed };
  });
}
