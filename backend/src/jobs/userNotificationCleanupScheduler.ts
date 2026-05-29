import cron from "node-cron";
import CleanupOldUserNotificationsService from "../services/UserNotificationService/CleanupOldUserNotificationsService";
import { logger } from "../utils/logger";

let running = false;

/** A cada 6 horas + uma execução no arranque do servidor. */
const CRON_EVERY_6_HOURS = "0 */6 * * *";

async function runCleanup(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await CleanupOldUserNotificationsService();
  } catch (e) {
    logger.warn({ err: e }, "[UserNotificationsCleanup] job_failed");
  } finally {
    running = false;
  }
}

export function startUserNotificationCleanupScheduler(): void {
  void runCleanup();
  cron.schedule(CRON_EVERY_6_HOURS, () => {
    void runCleanup();
  });
}
