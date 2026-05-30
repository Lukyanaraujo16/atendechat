import cron from "node-cron";
import { createApplicationBackup } from "../services/BackupService/createApplicationBackup";
import { pruneAutomaticBackups } from "../services/BackupService/pruneAutomaticBackups";
import { getBackupAutoConfig } from "../services/BackupService/backupAutoConfigService";
import {
  getGlobalBackupLockInfo,
  isGlobalBackupInProgress,
  runWithGlobalBackupLock
} from "../services/BackupService/backupGlobalLock";
import { logger } from "../utils/logger";
import { checkBackupDiskSpace } from "../services/BackupService/checkBackupDiskSpace";

let lastRunKey: string | null = null;

/**
 * Cron cada minuto: se backup automático estiver ativo e o relógio coincidir com horário/frequência,
 * gera ZIP com o mesmo serviço do backup manual e aplica retenção só sobre backups automáticos.
 */
export function startBackupAutoScheduler(): void {
  cron.schedule("* * * * *", async () => {
    try {
      const cfg = await getBackupAutoConfig();
      if (!cfg.backupAutoEnabled) return;

      const parts = cfg.backupAutoTime.split(":");
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return;

      const now = new Date();
      if (now.getHours() !== h || now.getMinutes() !== m) return;

      if (cfg.backupAutoFrequency === "weekly" && now.getDay() !== cfg.backupAutoWeekday) {
        return;
      }

      const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const runKey =
        cfg.backupAutoFrequency === "weekly"
          ? `${dayKey}-w${cfg.backupAutoWeekday}-${h}:${m}`
          : `${dayKey}-${h}:${m}`;

      if (lastRunKey === runKey) return;

      if (isGlobalBackupInProgress()) {
        const lock = getGlobalBackupLockInfo();
        logger.info(
          `[backup-auto] Ignorado (${runKey}): outro backup em curso (${lock?.source ?? "desconhecido"}).`
        );
        return;
      }

      const ownerId = `automatic-${runKey}`;
      try {
        let diskReport;
        try {
          diskReport = await checkBackupDiskSpace();
        } catch (diskErr: unknown) {
          const msg = diskErr instanceof Error ? diskErr.message : String(diskErr);
          logger.warn(
            `[backup-auto] Ignorado (${runKey}): não foi possível verificar disco (${msg}).`
          );
          return;
        }
        if (!diskReport.sufficient) {
          logger.warn(
            `[backup-auto] Ignorado (${runKey}): disco insuficiente. totalNeeded=${diskReport.totalNeeded} available=${diskReport.availableBytes} missing=${diskReport.missingBytes}`
          );
          return;
        }

        await runWithGlobalBackupLock("automatic", ownerId, async () => {
          await createApplicationBackup({ backupSource: "automatic" });
        });
        const removed = await pruneAutomaticBackups(cfg.backupAutoRetention);
        lastRunKey = runKey;
        logger.info(
          `[backup-auto] Concluído. Retenção=${cfg.backupAutoRetention}, removidos=${removed.length}`
        );
      } catch (e) {
        logger.error(e);
      }
    } catch (e) {
      logger.error(e);
    }
  });
}
