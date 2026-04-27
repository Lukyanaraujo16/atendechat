import cron from "node-cron";
import CleanupOldUserNotificationsService from "../services/UserNotificationService/CleanupOldUserNotificationsService";
import { logger } from "../utils/logger";

let running = false;

/** Diariamente às 04:15 — manutenção leve da tabela UserNotifications. */
export function startUserNotificationCleanupScheduler(): void {
  cron.schedule("15 4 * * *", async () => {
    if (running) return;
    running = true;
    try {
      await CleanupOldUserNotificationsService();
    } catch (e) {
      logger.warn({ err: e }, "[UserNotificationCleanup] job_failed");
    } finally {
      running = false;
    }
  });
}
