import cron from "node-cron";
import { logger } from "../utils/logger";
import { runLiveHardeningCleanup } from "../services/AutomationOrchestrator/liveRollout/hardening/LiveHardeningHealth";

let running = false;

/** Diário às 03:15 — retenção evidence/runtime Live. */
const CRON_DAILY = "15 3 * * *";

async function runCleanup(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const result = await runLiveHardeningCleanup();
    logger.info({ result }, "[LiveHardeningCleanup] done");
  } catch (e) {
    logger.warn({ err: e }, "[LiveHardeningCleanup] job_failed");
  } finally {
    running = false;
  }
}

export function startLiveHardeningCleanupScheduler(): void {
  cron.schedule(CRON_DAILY, () => {
    void runCleanup();
  });
  logger.info("[LiveHardeningCleanup] scheduler_registered");
}
