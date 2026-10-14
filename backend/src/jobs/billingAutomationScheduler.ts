import cron from "node-cron";
import { runBillingAutomationJob } from "../services/CompanyService/BillingAutomationJob";
import { logger } from "../utils/logger";

let billingJobRunning = false;

/**
 * Agenda leve: a cada hora (minuto 25) o job é idempotente graças à deduplicação em CompanyLogs.
 */
export function startBillingAutomationScheduler(): void {
  cron.schedule("25 * * * *", async () => {
    if (billingJobRunning) return;
    billingJobRunning = true;
    try {
      await runBillingAutomationJob();
    } catch (e) {
      logger.error(e);
    } finally {
      billingJobRunning = false;
    }
  });

  // Conciliação settle Cobranças — retries limitados (flag OFF por default)
  cron.schedule("40 * * * *", async () => {
    try {
      const { retryPendingSettles } = await import(
        "../services/SaasBilling/retryReconciliationSettle"
      );
      const result = await retryPendingSettles();
      if (result.processed > 0) {
        logger.info(result, "[SaasBilling] reconciliation_retry");
      }
    } catch (e) {
      logger.warn(e, "[SaasBilling] reconciliation_retry_failed");
    }
  });
}
