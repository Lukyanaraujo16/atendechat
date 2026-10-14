import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import SaaSPayment from "../../models/SaaSPayment";
import Invoices from "../../models/Invoices";
import { settleEfiCobrancasCharge } from "./efiCobrancasClient";
import { saasBillingFlags } from "../../config/saasBillingFlags";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { logger } from "../../utils/logger";
import { Op } from "sequelize";

const MAX_RETRIES = 5;

/**
 * Retenta settle Cobranças para itens de conciliação pendentes.
 * Não tenta "pagar" Pix.
 */
export async function retryPendingSettles(): Promise<{ processed: number; synced: number }> {
  if (!saasBillingFlags.cobrancasSettleEnabled()) {
    return { processed: 0, synced: 0 };
  }

  const items = await SaaSReconciliationItem.findAll({
    where: {
      status: "pending",
      kind: "manual_settle_divergence",
      retryCount: { [Op.lt]: MAX_RETRIES }
    },
    limit: 20,
    order: [["id", "ASC"]]
  });

  let synced = 0;
  for (const item of items) {
    try {
      const payment = item.paymentId
        ? await SaaSPayment.findByPk(item.paymentId)
        : null;
      const invoice = item.invoiceId
        ? await Invoices.findByPk(item.invoiceId)
        : null;
      const chargeId =
        payment?.externalChargeId || invoice?.externalChargeId || null;
      if (!chargeId) {
        await item.update({
          retryCount: item.retryCount + 1,
          lastError: "Sem chargeId para settle"
        });
        continue;
      }

      await settleEfiCobrancasCharge(String(chargeId));
      if (payment) {
        await payment.update({
          gatewaySyncStatus: "synced",
          gatewaySyncError: null
        });
      }
      if (invoice) {
        await invoice.update({
          gatewaySyncStatus: "synced",
          gatewaySyncError: null
        });
      }
      await item.update({
        status: "resolved",
        resolvedAt: new Date(),
        retryCount: item.retryCount + 1,
        message: "Settle Efí concluído no retry"
      });
      await recordFinancialEvent({
        companyId: item.companyId,
        invoiceId: item.invoiceId,
        paymentId: item.paymentId,
        eventType: "gateway_settle_retry_success",
        payload: { chargeId }
      });
      synced += 1;
    } catch (err: any) {
      logger.warn({ err, id: item.id }, "[SaasBilling] settle_retry_failed");
      await item.update({
        retryCount: item.retryCount + 1,
        lastError: err?.message || String(err),
        status: item.retryCount + 1 >= MAX_RETRIES ? "failed" : "pending"
      });
    }
  }

  return { processed: items.length, synced };
}
