import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import uploadConfig from "../../config/upload";
import { getBackupsRoot, ensureBackupDirs } from "../../config/backup";
import { createApplicationBackup } from "./createApplicationBackup";
import {
  grantPostgresAppUserAfterSuperuserImport,
  restoreMysqlFromSqlFile,
  restorePostgresFromSqlFile,
  runSequelizeDbMigrateAfterRestore,
  verifyRestoredSchemaCoreTables
} from "./restoreDatabase";
import type { BackupManifest } from "./createApplicationBackup";

/**
 * Extrai, valida manifest v1, cria backup de segurança, importa SQL e substitui `public/`.
 */
export async function restoreFromValidatedZipFile(zipAbsolutePath: string): Promise<{
  safetyBackupFileName: string;
  manifest: BackupManifest;
}> {
  const zip = new AdmZip(zipAbsolutePath);
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

  const currentDialect = (process.env.DB_DIALECT || "mysql").toLowerCase();
  const backupDialect = (manifest.dbDialect || "").toLowerCase();
  if (backupDialect !== currentDialect) {
    throw new Error(`BACKUP_DIALECT_MISMATCH:${backupDialect}->${currentDialect}`);
  }

  ensureBackupDirs();
  const extractRoot = path.join(
    getBackupsRoot(),
    `.restore-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  await fs.promises.mkdir(extractRoot, { recursive: true });
  zip.extractAllTo(extractRoot, true);

  const sqlPath = path.join(extractRoot, "database.sql");
  const publicExtracted = path.join(extractRoot, "public");

  if (!fs.existsSync(sqlPath)) {
    await fs.promises.rm(extractRoot, { recursive: true, force: true });
    throw new Error("BACKUP_MISSING_SQL");
  }

  // Backup de segurança do estado atual (ZIP completo).
  const safety = await createApplicationBackup({ backupSource: "pre_restore" });
  const safetyName = `coreflow-backup-antes-restauro-${Date.now()}.zip`;
  const safetyDest = path.join(getBackupsRoot(), safetyName);
  await fs.promises.rename(safety.absolutePath, safetyDest);

  try {
    if (currentDialect === "postgres" || currentDialect === "postgresql") {
      await restorePostgresFromSqlFile(sqlPath);
      await grantPostgresAppUserAfterSuperuserImport();
    } else {
      await restoreMysqlFromSqlFile(sqlPath);
    }

    await runSequelizeDbMigrateAfterRestore();
    await verifyRestoredSchemaCoreTables();

    const publicTarget = uploadConfig.directory;
    if (fs.existsSync(publicExtracted)) {
      await fs.promises.rm(publicTarget, { recursive: true, force: true });
      await fs.promises.cp(publicExtracted, publicTarget, { recursive: true });
    }
  } catch (e) {
    await fs.promises.rm(extractRoot, { recursive: true, force: true }).catch(() => {});
    throw e;
  }

  await fs.promises.rm(extractRoot, { recursive: true, force: true }).catch(() => {});

  return { safetyBackupFileName: safetyName, manifest };
}
