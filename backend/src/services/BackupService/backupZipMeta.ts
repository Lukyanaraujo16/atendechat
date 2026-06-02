import fs from "fs";
import path from "path";
import { getBackupsRoot, isSafeBackupZipFileName } from "../../config/backup";
import type { BackupManifest, BackupSource } from "./createApplicationBackup";

/** Limite para inspeção AdmZip em backups antigos sem .meta.json */
export const MAX_ZIP_INSPECT_BYTES = 512 * 1024 * 1024;

export const BACKUP_META_FILE_SUFFIX = ".zip.meta.json";

export type BackupListStatus = "ok" | "invalid" | "unknown";

export interface BackupZipMeta {
  status: "ok";
  formatVersion: 1;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  backupSource: BackupSource;
  dbDialect: string;
  dbName: string;
  includesPublicFiles: boolean;
  appVersion: string;
  generatedAt: string;
  completedAt: string;
}

export function getBackupMetaFileName(zipFileName: string): string {
  return `${zipFileName}${BACKUP_META_FILE_SUFFIX}`;
}

export function getBackupMetaAbsolutePath(
  root: string,
  zipFileName: string
): string {
  return path.join(root, getBackupMetaFileName(zipFileName));
}

export function isBackupSidecarMetaFileName(name: string): boolean {
  if (!name.endsWith(BACKUP_META_FILE_SUFFIX)) return false;
  const zipName = name.slice(0, -BACKUP_META_FILE_SUFFIX.length);
  return isSafeBackupZipFileName(zipName);
}

export function buildBackupZipMeta(params: {
  fileName: string;
  sizeBytes: number;
  manifest: BackupManifest;
  completedAt?: string;
}): BackupZipMeta {
  const completedAt = params.completedAt ?? new Date().toISOString();
  const backupSource: BackupSource =
    params.manifest.backupSource === "automatic" ||
    params.manifest.backupSource === "pre_restore" ||
    params.manifest.backupSource === "manual"
      ? params.manifest.backupSource
      : "manual";

  return {
    status: "ok",
    formatVersion: 1,
    fileName: params.fileName,
    sizeBytes: params.sizeBytes,
    createdAt: params.manifest.createdAt,
    backupSource,
    dbDialect: params.manifest.dbDialect,
    dbName: params.manifest.dbName,
    includesPublicFiles: params.manifest.includesPublicFiles,
    appVersion: params.manifest.appVersion,
    generatedAt: params.manifest.createdAt,
    completedAt
  };
}

export async function writeBackupZipMeta(
  zipFileName: string,
  meta: BackupZipMeta,
  root?: string
): Promise<void> {
  const backupsRoot = root ?? getBackupsRoot();
  const abs = getBackupMetaAbsolutePath(backupsRoot, zipFileName);
  await fs.promises.writeFile(abs, JSON.stringify(meta, null, 2), "utf8");
}

export async function readBackupZipMeta(
  zipFileName: string,
  root?: string
): Promise<BackupZipMeta | null> {
  const backupsRoot = root ?? getBackupsRoot();
  const abs = getBackupMetaAbsolutePath(backupsRoot, zipFileName);
  if (!fs.existsSync(abs)) return null;

  try {
    const raw = await fs.promises.readFile(abs, "utf8");
    const parsed = JSON.parse(raw) as BackupZipMeta;
    if (parsed?.status !== "ok" || parsed.formatVersion !== 1) return null;
    if (parsed.fileName !== zipFileName) return null;
    if (!isSafeBackupZipFileName(parsed.fileName)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Apaga ZIP final e sidecar .meta.json (meta é best-effort). */
export async function deleteBackupZipAndMeta(
  zipFileName: string,
  root?: string
): Promise<void> {
  const backupsRoot = root ?? getBackupsRoot();
  const zipAbs = path.join(backupsRoot, zipFileName);
  const metaAbs = getBackupMetaAbsolutePath(backupsRoot, zipFileName);
  await fs.promises.unlink(zipAbs);
  if (fs.existsSync(metaAbs)) {
    await fs.promises.unlink(metaAbs).catch(() => {});
  }
}

export function metaToManifestPartial(meta: BackupZipMeta): Partial<BackupManifest> {
  return {
    formatVersion: 1,
    appName: "coreflow",
    appVersion: meta.appVersion,
    createdAt: meta.createdAt,
    dbDialect: meta.dbDialect,
    dbHost: "",
    dbName: meta.dbName,
    includesPublicFiles: meta.includesPublicFiles,
    backupSource: meta.backupSource,
    notes: ""
  };
}
