import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import {
  getBackupsRoot,
  isAppGeneratedBackupZipBaseName,
  isBackupTempZipFileName
} from "../../config/backup";
import type { BackupManifest, BackupSource } from "./createApplicationBackup";
import {
  isBackupSidecarMetaFileName,
  MAX_ZIP_INSPECT_BYTES,
  metaToManifestPartial,
  readBackupZipMeta,
  type BackupListStatus
} from "./backupZipMeta";

export type { BackupListStatus };

export interface BackupListItem {
  fileName: string;
  sizeBytes: number;
  createdAt: string | null;
  status: BackupListStatus;
  manifest: Partial<BackupManifest> | null;
  /** Inferido do manifest/meta; backups antigos sem campo usam heurística pelo nome. */
  backupSource: BackupSource;
}

function safeZipName(name: string): boolean {
  if (!name.endsWith(".zip")) return false;
  if (!isAppGeneratedBackupZipBaseName(name)) return false;
  return !name.includes("..") && !path.isAbsolute(name);
}

function resolveBackupSource(
  name: string,
  fromMeta?: BackupSource
): BackupSource {
  if (
    fromMeta === "automatic" ||
    fromMeta === "pre_restore" ||
    fromMeta === "manual"
  ) {
    return fromMeta;
  }
  if (name.includes("antes-restauro")) return "pre_restore";
  return "manual";
}

function tryInspectZipManifest(abs: string): {
  status: BackupListStatus;
  manifest: Partial<BackupManifest> | null;
  createdAt: string | null;
} {
  try {
    const zip = new AdmZip(abs);
    const entry = zip.getEntry("manifest.json");
    if (!entry) {
      return { status: "invalid", manifest: null, createdAt: null };
    }
    const txt = entry.getData().toString("utf8");
    const manifest = JSON.parse(txt) as BackupManifest;
    if (manifest?.formatVersion === 1) {
      return {
        status: "ok",
        manifest,
        createdAt: manifest?.createdAt || null
      };
    }
    return { status: "invalid", manifest, createdAt: manifest?.createdAt || null };
  } catch {
    return { status: "invalid", manifest: null, createdAt: null };
  }
}

function resolveStatusWithoutMeta(
  abs: string,
  sizeBytes: number
): {
  status: BackupListStatus;
  manifest: Partial<BackupManifest> | null;
  createdAt: string | null;
} {
  if (sizeBytes > MAX_ZIP_INSPECT_BYTES) {
    return { status: "unknown", manifest: null, createdAt: null };
  }
  return tryInspectZipManifest(abs);
}

export async function listBackupFiles(): Promise<BackupListItem[]> {
  const root = getBackupsRoot();
  if (!fs.existsSync(root)) return [];

  const names = await fs.promises.readdir(root);
  const items: BackupListItem[] = [];

  for (const name of names) {
    if (isBackupTempZipFileName(name)) continue;
    if (isBackupSidecarMetaFileName(name)) continue;
    if (!safeZipName(name)) continue;

    const abs = path.join(root, name);
    const st = await fs.promises.stat(abs);
    if (!st.isFile()) continue;

    const sidecar = await readBackupZipMeta(name, root);

    if (sidecar) {
      items.push({
        fileName: name,
        sizeBytes: st.size,
        createdAt: sidecar.createdAt,
        status: "ok",
        manifest: metaToManifestPartial(sidecar),
        backupSource: resolveBackupSource(name, sidecar.backupSource)
      });
      continue;
    }

    const fallback = resolveStatusWithoutMeta(abs, st.size);
    items.push({
      fileName: name,
      sizeBytes: st.size,
      createdAt: fallback.createdAt,
      status: fallback.status,
      manifest: fallback.manifest,
      backupSource: resolveBackupSource(
        name,
        fallback.manifest?.backupSource as BackupSource | undefined
      )
    });
  }

  items.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return items;
}
