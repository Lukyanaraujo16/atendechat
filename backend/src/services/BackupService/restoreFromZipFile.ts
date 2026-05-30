import fs from "fs";
import path from "path";
import AdmZip from "adm-zip";
import uploadConfig from "../../config/upload";
import { getBackupsRoot, ensureBackupDirs } from "../../config/backup";
import { createApplicationBackup } from "./createApplicationBackup";
import {
  assertNoGlobalBackupInProgress,
  runWithGlobalBackupLock
} from "./backupGlobalLock";
import {
  grantPostgresAppUserAfterSuperuserImport,
  restoreMysqlFromSqlFile,
  restorePostgresFromSqlFile,
  runSequelizeDbMigrateAfterRestore,
  verifyRestoredSchemaCoreTables
} from "./restoreDatabase";
import type { BackupManifest } from "./createApplicationBackup";
import { validateRestoreZipEntries } from "./validateRestoreZip";
import { inspectDatabaseForRestore } from "./inspectDatabaseForRestore";
import { clearDatabaseBeforeRestore } from "./clearDatabaseBeforeRestore";
import { assertBackupDiskSpaceAvailable } from "./checkBackupDiskSpace";
import AppError from "../../errors/AppError";

export interface RestoreFromZipOptions {
  /** Confirmação forte quando a BD já contém dados (obrigatória nesse caso). */
  substitutionConfirmed?: boolean;
}

/**
 * 1) Valida ZIP + public/
 * 2) Inspeciona BD (sem alterar)
 * 3) Exige confirmação forte se BD não vazia
 * 4) Backup pre_restore
 * 5) Limpa schema se BD não vazia e confirmado
 * 6) Import SQL → migrate → verificação → substitui public/
 */
export async function restoreFromValidatedZipFile(
  zipAbsolutePath: string,
  options?: RestoreFromZipOptions
): Promise<{
  safetyBackupFileName: string;
  manifest: BackupManifest;
}> {
  const zip = new AdmZip(zipAbsolutePath);
  const { manifest } = validateRestoreZipEntries(zip);

  const currentDialect = (process.env.DB_DIALECT || "mysql").toLowerCase();
  const backupDialect = (manifest.dbDialect || "").toLowerCase();
  if (backupDialect !== currentDialect) {
    throw new Error(`BACKUP_DIALECT_MISMATCH:${backupDialect}->${currentDialect}`);
  }

  const dbInspection = await inspectDatabaseForRestore();
  if (dbInspection.requiresStrongConfirmation && !options?.substitutionConfirmed) {
    throw new Error("BACKUP_STRONG_CONFIRMATION_REQUIRED");
  }

  assertNoGlobalBackupInProgress();

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

  if (!fs.existsSync(publicExtracted)) {
    await fs.promises.rm(extractRoot, { recursive: true, force: true });
    throw new Error("BACKUP_MISSING_PUBLIC_DIRECTORY");
  }

  try {
    await assertBackupDiskSpaceAvailable();
  } catch (err: unknown) {
    await fs.promises.rm(extractRoot, { recursive: true, force: true }).catch(() => {});
    if (err instanceof AppError) throw err;
    throw err;
  }

  const preRestoreOwnerId = `pre_restore-${Date.now()}`;
  const safety = await runWithGlobalBackupLock("pre_restore", preRestoreOwnerId, () =>
    createApplicationBackup({ backupSource: "pre_restore" })
  );
  const safetyName = safety.fileName;

  try {
    if (!dbInspection.databaseLooksEmpty && options?.substitutionConfirmed) {
      await clearDatabaseBeforeRestore();
    }

    if (currentDialect === "postgres" || currentDialect === "postgresql") {
      await restorePostgresFromSqlFile(sqlPath);
      await grantPostgresAppUserAfterSuperuserImport();
    } else {
      await restoreMysqlFromSqlFile(sqlPath);
    }

    await runSequelizeDbMigrateAfterRestore();
    await verifyRestoredSchemaCoreTables();

    const publicTarget = uploadConfig.directory;
    await fs.promises.rm(publicTarget, { recursive: true, force: true });
    await fs.promises.cp(publicExtracted, publicTarget, { recursive: true });
  } catch (e) {
    await fs.promises.rm(extractRoot, { recursive: true, force: true }).catch(() => {});
    throw e;
  }

  await fs.promises.rm(extractRoot, { recursive: true, force: true }).catch(() => {});

  return { safetyBackupFileName: safetyName, manifest };
}
