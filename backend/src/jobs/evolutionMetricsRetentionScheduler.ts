import cron from "node-cron";
import { purgeExpiredEvolutionMetrics } from "../services/SystemAdmin/EvolutionInfraMetricsService";
import { logger } from "../utils/logger";

let running = false;

/** A cada hora (minuto 17) + uma execução no arranque do servidor. */
const CRON_HOURLY = "17 * * * *";

async function runPurge(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const removed = await purgeExpiredEvolutionMetrics();
    if (removed > 0)
      logger.info({ removed }, "[EvolutionMetricsRetention] purged");
  } catch (e) {
    logger.warn({ err: e }, "[EvolutionMetricsRetention] job_failed");
  } finally {
    running = false;
  }
}

export function startEvolutionMetricsRetentionScheduler(): void {
  void runPurge();
  cron.schedule(CRON_HOURLY, () => {
    void runPurge();
  });
}
