import path from "path";
import fs from "fs";

/**
 * Caminho centralizado para evolução futura (Fase 2):
 * - agendamento: cron/node-cron a chamar o mesmo serviço `createApplicationBackup`
 * - retenção: apagar ficheiros ZIP mais antigos que N dias neste diretório
 * - nuvem: após gerar, enviar cópia para S3/Drive e opcionalmente remover local
 */
/** Diretório de armazenamento de backups gerados (fora de /public; só acesso via API autenticada). */
export function getBackupsRoot(): string {
  return path.resolve(__dirname, "..", "..", "backups");
}

export function getIncomingRestoresDir(): string {
  return path.join(getBackupsRoot(), "incoming");
}

export function ensureBackupDirs(): void {
  const root = getBackupsRoot();
  const incoming = getIncomingRestoresDir();
  if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
  if (!fs.existsSync(incoming)) fs.mkdirSync(incoming, { recursive: true });
}

/** Pastas de trabalho abandonadas durante geração (ex.: backups/.tmp-1730.../). */
export function isBackupWorkTempDirName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const base = path.basename(name);
  if (base !== name || base.includes("..")) return false;
  return base.startsWith(".tmp-");
}

function resolveSafeUnderBackupsRoot(root: string, entryName: string): string | null {
  const abs = path.resolve(root, entryName);
  const rootResolved = path.resolve(root);
  if (!abs.startsWith(`${rootResolved}${path.sep}`) && abs !== rootResolved) {
    return null;
  }
  return abs;
}

export type BackupOrphanCleanupResult = {
  zipTmpFilesRemoved: number;
  workDirsRemoved: number;
};

/**
 * Remove apenas artefactos temporários de backup (nunca coreflow-backup-*.zip final).
 * - *.zip.tmp
 * - diretórios backups/.tmp-* (database.sql, public copiado, etc.)
 */
export async function cleanupOrphanBackupArtifacts(): Promise<BackupOrphanCleanupResult> {
  const root = getBackupsRoot();
  const result: BackupOrphanCleanupResult = {
    zipTmpFilesRemoved: 0,
    workDirsRemoved: 0
  };
  if (!fs.existsSync(root)) return result;

  const names = await fs.promises.readdir(root, { withFileTypes: true });

  for (const dirent of names) {
    const name = dirent.name;
    const safePath = resolveSafeUnderBackupsRoot(root, name);
    if (!safePath) continue;

    if (dirent.isFile() && isBackupTempZipFileName(name)) {
      try {
        await fs.promises.unlink(safePath);
        result.zipTmpFilesRemoved += 1;
      } catch {
        /* ignore */
      }
      continue;
    }

    if (dirent.isDirectory() && isBackupWorkTempDirName(name)) {
      try {
        await fs.promises.rm(safePath, { recursive: true, force: true });
        result.workDirsRemoved += 1;
      } catch {
        /* ignore */
      }
    }
  }

  return result;
}

/** @deprecated Use cleanupOrphanBackupArtifacts */
export async function cleanupOrphanBackupTempFiles(): Promise<number> {
  const r = await cleanupOrphanBackupArtifacts();
  return r.zipTmpFilesRemoved;
}

/** Novos ficheiros gerados pela app. */
export const BACKUP_FILENAME_PREFIX = "coreflow-backup-";

/** Sufixo enquanto o ZIP está a ser escrito (não listar nem descarregar). */
export const BACKUP_TEMP_ZIP_SUFFIX = ".zip.tmp";

/** Compressão ZIP: prioriza velocidade em backups grandes (public/mídias). */
export const BACKUP_ZLIB_LEVEL = 1;

export function isBackupTempZipFileName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const base = path.basename(name);
  return (
    (base.startsWith(BACKUP_FILENAME_PREFIX) ||
      base.startsWith(LEGACY_BACKUP_FILENAME_PREFIX)) &&
    base.endsWith(BACKUP_TEMP_ZIP_SUFFIX)
  );
}
/** Backups antigos (antes da renomeação interna) — mantido para listagem/restauro. */
export const LEGACY_BACKUP_FILENAME_PREFIX = "atendechat-backup-";

export const BACKUP_CONFIRM_PHRASE = "RESTAURAR";
export const BACKUP_DELETE_CONFIRM_PHRASE = "EXCLUIR";

/** Confirmação obrigatória ao restaurar sobre base que já contém dados. */
export const BACKUP_STRONG_CONFIRM_PHRASES = [
  "RESTAURAR E SUBSTITUIR",
  "ENTENDO QUE OS DADOS ATUAIS SERÃO SUBSTITUÍDOS"
] as const;

export function isStrongRestoreConfirmation(value: string | undefined): boolean {
  if (!value || typeof value !== "string") return false;
  const normalized = value.trim();
  return (BACKUP_STRONG_CONFIRM_PHRASES as readonly string[]).includes(normalized);
}

export const BACKUP_MISSING_PUBLIC_MESSAGE =
  "Backup inválido: pasta public/ ausente. Restauração abortada para evitar inconsistência de arquivos.";

/** ZIP gerado por esta aplicação (prefixo atual ou legado). */
export function isAppGeneratedBackupZipBaseName(base: string): boolean {
  if (!base || base.includes("..")) return false;
  return (
    base.startsWith(BACKUP_FILENAME_PREFIX) ||
    base.startsWith(LEGACY_BACKUP_FILENAME_PREFIX)
  );
}

/** Nomes de ZIP permitidos na pasta de backups (gerados pela app). */
export function isSafeBackupZipFileName(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const base = path.basename(name);
  if (base !== name || base.includes("..")) return false;
  return /^(coreflow-backup-|atendechat-backup-).+\.zip$/.test(base);
}
