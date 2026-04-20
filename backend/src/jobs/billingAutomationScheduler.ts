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
}
