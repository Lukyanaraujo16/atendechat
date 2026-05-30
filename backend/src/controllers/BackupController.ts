import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import AdmZip from "adm-zip";
import AppError from "../errors/AppError";
import {
  getBackupsRoot,
  getIncomingRestoresDir,
  BACKUP_CONFIRM_PHRASE,
  BACKUP_STRONG_CONFIRM_PHRASES,
  BACKUP_MISSING_PUBLIC_MESSAGE,
  isSafeBackupZipFileName,
  isStrongRestoreConfirmation
} from "../config/backup";
import { createApplicationBackup } from "../services/BackupService/createApplicationBackup";
import { listBackupFiles } from "../services/BackupService/listBackupFiles";
import { restoreFromValidatedZipFile } from "../services/BackupService/restoreFromZipFile";
import type { BackupManifest } from "../services/BackupService/createApplicationBackup";
import {
  getBackupAutoConfig,
  upsertBackupAutoConfig,
  type BackupAutoConfigPayload
} from "../services/BackupService/backupAutoConfigService";
import { validateRestoreZipEntries } from "../services/BackupService/validateRestoreZip";
import { inspectDatabaseForRestore } from "../services/BackupService/inspectDatabaseForRestore";

export const list = async (_req: Request, res: Response): Promise<void> => {
  const items = await listBackupFiles();
  res.json({ backups: items });
};

export const generate = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await createApplicationBackup({ backupSource: "manual" });
    res.status(201).json({
      ok: true,
      fileName: result.fileName,
      sizeBytes: result.sizeBytes,
      manifest: result.manifest
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("mysqldump") || msg.includes("pg_dump")) {
      throw new AppError(
        "BACKUP_DUMP_FAILED",
        500,
        "Verifique se mysqldump/pg_dump está no PATH e se as credenciais DB em .env estão corretas."
      );
    }
    throw err;
  }
};

export const download = async (req: Request, res: Response): Promise<void> => {
  const raw = req.params.fileName;
  if (!isSafeBackupZipFileName(raw)) {
    throw new AppError("BACKUP_INVALID_NAME", 400);
  }
  const abs = path.join(getBackupsRoot(), path.basename(raw));
  if (!fs.existsSync(abs)) {
    throw new AppError("BACKUP_NOT_FOUND", 404);
  }
  res.download(abs, path.basename(raw));
};

export const prepareRestore = async (req: Request, res: Response): Promise<void> => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file?.path) {
    throw new AppError("BACKUP_FILE_REQUIRED", 400);
  }

  let manifest: BackupManifest;
  let hasPublicDirectoryInZip: boolean;
  try {
    const zip = new AdmZip(file.path);
    const validated = validateRestoreZipEntries(zip);
    manifest = validated.manifest;
    hasPublicDirectoryInZip = validated.hasPublicDirectoryInZip;
  } catch (err: unknown) {
    await fs.promises.unlink(file.path).catch(() => {});
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("BACKUP_MISSING_PUBLIC_DIRECTORY")) {
      throw new AppError("BACKUP_MISSING_PUBLIC_DIRECTORY", 400, BACKUP_MISSING_PUBLIC_MESSAGE);
    }
    throw new AppError("BACKUP_INVALID_ARCHIVE", 400);
  }

  const currentDialect = (process.env.DB_DIALECT || "mysql").toLowerCase();
  const backupDialect = (manifest.dbDialect || "").toLowerCase();
  if (backupDialect !== currentDialect) {
    await fs.promises.unlink(file.path).catch(() => {});
    throw new AppError(
      "BACKUP_DIALECT_MISMATCH",
      400,
      `O backup é ${backupDialect} mas o servidor está ${currentDialect}.`
    );
  }

  const dbInspection = await inspectDatabaseForRestore();
  const restoreToken = path.basename(file.filename, ".zip");

  res.json({
    ok: true,
    restoreToken,
    preview: {
      createdAt: manifest.createdAt,
      appVersion: manifest.appVersion,
      dbDialect: manifest.dbDialect,
      dbName: manifest.dbName,
      notes: manifest.notes
    },
    databaseLooksEmpty: dbInspection.databaseLooksEmpty,
    existingTablesCount: dbInspection.existingTablesCount,
    existingCriticalTables: dbInspection.existingCriticalTables,
    hasPublicDirectoryInZip,
    requiresStrongConfirmation: dbInspection.requiresStrongConfirmation,
    strongConfirmationPhrases: [...BACKUP_STRONG_CONFIRM_PHRASES]
  });
};

export const executeRestore = async (req: Request, res: Response): Promise<void> => {
  const { restoreToken, confirmPhrase, confirmation } = req.body as {
    restoreToken?: string;
    confirmPhrase?: string;
    confirmation?: string;
  };

  if (!restoreToken || typeof restoreToken !== "string") {
    throw new AppError("BACKUP_TOKEN_REQUIRED", 400);
  }

  const safeToken = path.basename(restoreToken);
  if (!/^[a-f0-9-]{36}$/i.test(safeToken)) {
    throw new AppError("BACKUP_INVALID_TOKEN", 400);
  }

  const zipPath = path.join(getIncomingRestoresDir(), `${safeToken}.zip`);
  if (!fs.existsSync(zipPath)) {
    throw new AppError("BACKUP_UPLOAD_EXPIRED_OR_MISSING", 404);
  }

  let dbInspection;
  try {
    const zip = new AdmZip(zipPath);
    validateRestoreZipEntries(zip);
    dbInspection = await inspectDatabaseForRestore();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("BACKUP_MISSING_PUBLIC_DIRECTORY")) {
      throw new AppError("BACKUP_MISSING_PUBLIC_DIRECTORY", 400, BACKUP_MISSING_PUBLIC_MESSAGE);
    }
    throw new AppError("BACKUP_INVALID_ARCHIVE", 400);
  }

  const strongPhrase = (confirmation || confirmPhrase || "").trim();
  const basicPhrase = (confirmPhrase || "").trim();

  if (dbInspection.requiresStrongConfirmation) {
    if (!isStrongRestoreConfirmation(strongPhrase)) {
      throw new AppError(
        "BACKUP_STRONG_CONFIRMATION_REQUIRED",
        403,
        `A base atual contém dados. Digite exatamente uma destas frases: ${BACKUP_STRONG_CONFIRM_PHRASES.join(" — ")}`
      );
    }
  } else if (basicPhrase !== BACKUP_CONFIRM_PHRASE) {
    throw new AppError("BACKUP_CONFIRM_REQUIRED", 400, `Digite exatamente: ${BACKUP_CONFIRM_PHRASE}`);
  }

  try {
    const result = await restoreFromValidatedZipFile(zipPath, {
      substitutionConfirmed: dbInspection.requiresStrongConfirmation
        ? isStrongRestoreConfirmation(strongPhrase)
        : false
    });
    await fs.promises.unlink(zipPath).catch(() => {});
    res.json({
      ok: true,
      safetyBackupFileName: result.safetyBackupFileName,
      message:
        "Restauração concluída. Foi criado um backup de segurança antes da operação. Recomenda-se reiniciar o backend e reconectar sessões."
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "BACKUP_STRONG_CONFIRMATION_REQUIRED") {
      throw new AppError(
        "BACKUP_STRONG_CONFIRMATION_REQUIRED",
        403,
        `Confirmação forte obrigatória: ${BACKUP_STRONG_CONFIRM_PHRASES.join(" — ")}`
      );
    }
    if (msg.startsWith("BACKUP_MISSING_PUBLIC_DIRECTORY")) {
      throw new AppError("BACKUP_MISSING_PUBLIC_DIRECTORY", 400, BACKUP_MISSING_PUBLIC_MESSAGE);
    }
    if (
      msg.startsWith("BACKUP_") &&
      !msg.startsWith("BACKUP_RESTORE_FAILED") &&
      !msg.includes("RESTORE_")
    ) {
      throw new AppError(msg.split(":")[0] || msg, 400, msg.includes(":") ? msg.split(":").slice(1).join(":") : undefined);
    }
    if (
      msg.startsWith("RESTORE_SCHEMA_INCOMPLETE") ||
      msg.startsWith("RESTORE_MIGRATE_FAILED") ||
      msg.startsWith("RESTORE_CLEAR_") ||
      msg.includes("psql import failed") ||
      msg.includes("mysql import failed")
    ) {
      throw new AppError("BACKUP_RESTORE_FAILED", 500, msg);
    }
    throw new AppError("BACKUP_RESTORE_FAILED", 500, msg);
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  const raw = req.params.fileName;
  if (!isSafeBackupZipFileName(raw)) {
    throw new AppError("BACKUP_INVALID_NAME", 400);
  }
  const base = path.basename(raw);
  const abs = path.join(getBackupsRoot(), base);
  if (!fs.existsSync(abs)) {
    throw new AppError("BACKUP_NOT_FOUND", 404);
  }
  try {
    await fs.promises.unlink(abs);
  } catch {
    throw new AppError("BACKUP_DELETE_FAILED", 500, "Não foi possível apagar o ficheiro.");
  }
  res.status(204).end();
};

export const getBackupConfig = async (_req: Request, res: Response): Promise<void> => {
  const config = await getBackupAutoConfig();
  res.json(config);
};

export const updateBackupConfig = async (req: Request, res: Response): Promise<void> => {
  const body = req.body as Partial<BackupAutoConfigPayload>;
  const partial: Partial<BackupAutoConfigPayload> = {};

  if (body.backupAutoEnabled !== undefined) {
    partial.backupAutoEnabled = Boolean(body.backupAutoEnabled);
  }
  if (body.backupAutoFrequency !== undefined) {
    const f = String(body.backupAutoFrequency).toLowerCase();
    if (f !== "daily" && f !== "weekly") {
      throw new AppError("BACKUP_CONFIG_INVALID_FREQUENCY", 400);
    }
    partial.backupAutoFrequency = f;
  }
  if (body.backupAutoTime !== undefined) {
    partial.backupAutoTime = String(body.backupAutoTime).trim();
  }
  if (body.backupAutoWeekday !== undefined) {
    const w = Number(body.backupAutoWeekday);
    if (Number.isNaN(w) || w < 0 || w > 6) {
      throw new AppError("BACKUP_CONFIG_INVALID_WEEKDAY", 400);
    }
    partial.backupAutoWeekday = w;
  }
  if (body.backupAutoRetention !== undefined) {
    const r = Number(body.backupAutoRetention);
    if (Number.isNaN(r) || r < 1 || r > 365) {
      throw new AppError("BACKUP_CONFIG_INVALID_RETENTION", 400);
    }
    partial.backupAutoRetention = r;
  }

  const config = await upsertBackupAutoConfig(partial);
  res.json(config);
};
