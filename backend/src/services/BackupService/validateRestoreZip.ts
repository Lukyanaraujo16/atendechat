import AdmZip from "adm-zip";
import type { BackupManifest } from "./createApplicationBackup";
import { BACKUP_MISSING_PUBLIC_MESSAGE } from "../../config/backup";

export type RestoreZipValidation = {
  manifest: BackupManifest;
  hasPublicDirectoryInZip: boolean;
};

export function zipHasPublicDirectory(zip: AdmZip): boolean {
  return zip.getEntries().some((entry) => {
    const name = entry.entryName.replace(/\\/g, "/");
    return name === "public/" || name.startsWith("public/");
  });
}

export function assertPublicDirectoryInRestoreZip(
  manifest: BackupManifest,
  hasPublicDirectoryInZip: boolean
): void {
  const mustInclude = manifest.includesPublicFiles !== false;
  if (mustInclude && !hasPublicDirectoryInZip) {
    throw new Error(`BACKUP_MISSING_PUBLIC_DIRECTORY:${BACKUP_MISSING_PUBLIC_MESSAGE}`);
  }
}

export function validateRestoreZipEntries(zip: AdmZip): RestoreZipValidation {
  const manifestEntry = zip.getEntry("manifest.json");
  const sqlEntry = zip.getEntry("database.sql");
  if (!manifestEntry || !sqlEntry) {
    throw new Error("BACKUP_INVALID_ARCHIVE_STRUCTURE");
  }

  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString("utf8")) as BackupManifest;
  } catch {
    throw new Error("BACKUP_INVALID_MANIFEST");
  }
  if (manifest.formatVersion !== 1) {
    throw new Error("BACKUP_UNSUPPORTED_FORMAT");
  }

  const hasPublicDirectoryInZip = zipHasPublicDirectory(zip);
  assertPublicDirectoryInRestoreZip(manifest, hasPublicDirectoryInZip);

  return { manifest, hasPublicDirectoryInZip };
}
