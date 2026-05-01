import cron from "node-cron";
import { runCompanyStorageRecalcJob } from "./companyStorageRecalcJob";
import { logger } from "../utils/logger";

/** Agenda pesada: recálculo diário (03:40); valores em DB evitam custo por request. */
export function startCompanyStorageRecalcScheduler(): void {
  cron.schedule("40 3 * * *", async () => {
    try {
      await runCompanyStorageRecalcJob();
    } catch (e) {
      logger.error(e);
    }
  });
}
