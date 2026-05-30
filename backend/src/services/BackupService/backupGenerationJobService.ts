import { v4 as uuidv4 } from "uuid";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";
import {
  createApplicationBackup,
  type BackupProgressStep,
  type BackupSource
} from "./createApplicationBackup";
import {
  getGlobalBackupLockInfo,
  isGlobalBackupInProgress,
  runWithGlobalBackupLock
} from "./backupGlobalLock";
import { assertBackupDiskSpaceAvailable } from "./checkBackupDiskSpace";

export type BackupJobStatus = "running" | "completed" | "failed";

export type BackupGenerationJob = {
  jobId: string;
  status: BackupJobStatus;
  step: BackupProgressStep | null;
  backupSource: BackupSource;
  startedAt: string;
  finishedAt: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  error: string | null;
};

const jobs = new Map<string, BackupGenerationJob>();

function toPublicJob(job: BackupGenerationJob): BackupGenerationJob {
  return { ...job };
}

export function getBackupGenerationJob(jobId: string): BackupGenerationJob | null {
  const job = jobs.get(jobId);
  return job ? toPublicJob(job) : null;
}

export function getActiveManualBackupJob(): BackupGenerationJob | null {
  const lock = getGlobalBackupLockInfo();
  if (!lock || lock.source !== "manual") return null;
  const job = jobs.get(lock.ownerId);
  if (!job || job.status !== "running") return null;
  return toPublicJob(job);
}

function updateJob(jobId: string, patch: Partial<BackupGenerationJob>): void {
  const job = jobs.get(jobId);
  if (!job) return;
  Object.assign(job, patch);
}

function pruneOldJobs(): void {
  if (jobs.size <= 30) return;
  const finished = [...jobs.entries()]
    .filter(([, j]) => j.status !== "running")
    .sort((a, b) => {
      const ta = a[1].finishedAt ? new Date(a[1].finishedAt).getTime() : 0;
      const tb = b[1].finishedAt ? new Date(b[1].finishedAt).getTime() : 0;
      return ta - tb;
    });
  const excess = finished.length - 20;
  for (let i = 0; i < excess; i++) {
    jobs.delete(finished[i][0]);
  }
}

/**
 * Inicia backup manual em background; resposta HTTP imediata com jobId.
 */
export async function startManualBackupGenerationJob(): Promise<{
  jobId: string;
  message: string;
}> {
  if (isGlobalBackupInProgress()) {
    const lock = getGlobalBackupLockInfo();
    throw new AppError(
      "BACKUP_JOB_ALREADY_RUNNING",
      409,
      `Já existe um backup em andamento${lock ? ` (${lock.source})` : ""}. Aguarde a conclusão.`
    );
  }

  await assertBackupDiskSpaceAvailable();

  const jobId = uuidv4();
  const startedAt = new Date().toISOString();
  const job: BackupGenerationJob = {
    jobId,
    status: "running",
    step: "dumping_database",
    backupSource: "manual",
    startedAt,
    finishedAt: null,
    fileName: null,
    sizeBytes: null,
    error: null
  };
  jobs.set(jobId, job);
  pruneOldJobs();

  void runBackupJob(jobId).catch((e) => {
    logger.error(e);
  });

  return {
    jobId,
    message: "Backup iniciado. Acompanhe o progresso abaixo."
  };
}

async function runBackupJob(jobId: string): Promise<void> {
  try {
    const result = await runWithGlobalBackupLock("manual", jobId, () =>
      createApplicationBackup({
        backupSource: "manual",
        onProgress: ({ step }) => {
          updateJob(jobId, { step });
        }
      })
    );
    updateJob(jobId, {
      status: "completed",
      step: null,
      finishedAt: new Date().toISOString(),
      fileName: result.fileName,
      sizeBytes: result.sizeBytes,
      error: null
    });
    logger.info(
      `[backup-job] ${jobId} concluído: ${result.fileName} (${result.sizeBytes} bytes)`
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    updateJob(jobId, {
      status: "failed",
      step: null,
      finishedAt: new Date().toISOString(),
      error: msg
    });
    logger.error(`[backup-job] ${jobId} falhou: ${msg}`);
  }
}
