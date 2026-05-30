import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import {
  getBackupsRoot,
  isAppGeneratedBackupZipBaseName,
  isBackupTempZipFileName
} from "../../config/backup";
import type { BackupManifest, BackupSource } from "./createApplicationBackup";

export interface BackupListItem {
  fileName: string;
  sizeBytes: number;
  createdAt: string | null;
  status: "ok" | "invalid";
  manifest: Partial<BackupManifest> | null;
  /** Inferido do manifest; backups antigos sem campo usam heurística pelo nome. */
  backupSource: BackupSource;
}

function safeZipName(name: string): boolean {
  if (!name.endsWith(".zip")) return false;
  if (!isAppGeneratedBackupZipBaseName(name)) return false;
  return !name.includes("..") && !path.isAbsolute(name);
}

export async function listBackupFiles(): Promise<BackupListItem[]> {
  const root = getBackupsRoot();
  if (!fs.existsSync(root)) return [];

  const names = await fs.promises.readdir(root);
  const items: BackupListItem[] = [];

  for (const name of names) {
    if (isBackupTempZipFileName(name)) continue;
    if (!safeZipName(name)) continue;
    const abs = path.join(root, name);
    const st = await fs.promises.stat(abs);
    if (!st.isFile()) continue;

    let manifest: Partial<BackupManifest> | null = null;
    let createdAt: string | null = null;
    let status: "ok" | "invalid" = "invalid";
    try {
      const zip = new AdmZip(abs);
      const entry = zip.getEntry("manifest.json");
      if (entry) {
        const txt = entry.getData().toString("utf8");
        manifest = JSON.parse(txt) as BackupManifest;
        if (manifest?.formatVersion === 1) status = "ok";
        createdAt = manifest?.createdAt || null;
      }
    } catch {
      status = "invalid";
    }

    let backupSource: BackupSource = "manual";
    const mSrc = manifest?.backupSource;
    if (mSrc === "automatic" || mSrc === "pre_restore" || mSrc === "manual") {
      backupSource = mSrc;
    } else if (name.includes("antes-restauro")) {
      backupSource = "pre_restore";
    }

    items.push({
      fileName: name,
      sizeBytes: st.size,
      createdAt,
      status,
      manifest,
      backupSource
    });
  }

  items.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return items;
}
