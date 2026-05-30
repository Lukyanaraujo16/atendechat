import AppError from "../../errors/AppError";
import type { BackupSource } from "./createApplicationBackup";

export type GlobalBackupLockInfo = {
  source: BackupSource;
  ownerId: string;
  startedAt: string;
};

let activeLock: GlobalBackupLockInfo | null = null;

export function isGlobalBackupInProgress(): boolean {
  return activeLock !== null;
}

export function getGlobalBackupLockInfo(): GlobalBackupLockInfo | null {
  return activeLock ? { ...activeLock } : null;
}

/**
 * Trava global: no máximo um backup (manual, automático ou pre_restore) por processo.
 */
export function tryAcquireGlobalBackupLock(
  source: BackupSource,
  ownerId: string
): void {
  if (activeLock) {
    const running = activeLock.source;
    throw new AppError(
      "BACKUP_JOB_ALREADY_RUNNING",
      409,
      `Já existe um backup em andamento (${running}). Aguarde a conclusão antes de iniciar outro.`
    );
  }
  activeLock = {
    source,
    ownerId,
    startedAt: new Date().toISOString()
  };
}

export function releaseGlobalBackupLock(ownerId: string): void {
  if (activeLock?.ownerId === ownerId) {
    activeLock = null;
  }
}

/**
 * Executa trabalho de backup com trava global (liberta no finally).
 */
export async function runWithGlobalBackupLock<T>(
  source: BackupSource,
  ownerId: string,
  fn: () => Promise<T>
): Promise<T> {
  tryAcquireGlobalBackupLock(source, ownerId);
  try {
    return await fn();
  } finally {
    releaseGlobalBackupLock(ownerId);
  }
}

/** Bloqueia restore/pre_restore enquanto qualquer backup estiver ativo. */
export function assertNoGlobalBackupInProgress(): void {
  if (!activeLock) return;
  throw new AppError(
    "BACKUP_JOB_ALREADY_RUNNING",
    409,
    `Não é possível continuar: há um backup em andamento (${activeLock.source}). Aguarde a conclusão.`
  );
}
