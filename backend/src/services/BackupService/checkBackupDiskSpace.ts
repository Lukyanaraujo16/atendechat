import AppError from "../../errors/AppError";
import { estimateDatabaseSizeBytes } from "./estimateDatabaseSizeBytes";
import { estimatePublicDirectoryBytes } from "./estimatePublicDirectoryBytes";
import { getFilesystemAvailableBytes } from "./getFilesystemAvailableBytes";

const DB_SIZE_FACTOR = 1.15;
const ZIP_SIZE_FACTOR = 1.0;
const SAFETY_MARGIN_RATIO = 0.1;

export type BackupDiskSpaceReport = {
  databaseBytes: number;
  databaseEstimateBytes: number;
  publicDirectoryBytes: number;
  zipEstimateBytes: number;
  requiredBytes: number;
  safetyMarginBytes: number;
  totalNeeded: number;
  availableBytes: number;
  missingBytes: number;
  sufficient: boolean;
  /** Valores em GiB (bytes ÷ 1024³), 3 casas decimais. */
  databaseEstimateGb: number;
  publicDirectoryGb: number;
  zipEstimateGb: number;
  requiredGb: number;
  safetyMarginGb: number;
  totalNeededGb: number;
  availableGb: number;
  missingGb: number;
};

const GIB = 1024 ** 3;

export function bytesToGib(bytes: number): number {
  if (!Number.isFinite(bytes) || bytes <= 0) return 0;
  return Math.round((bytes / GIB) * 1000) / 1000;
}

function withGibFields(
  partial: Omit<
    BackupDiskSpaceReport,
    | "databaseEstimateGb"
    | "publicDirectoryGb"
    | "zipEstimateGb"
    | "requiredGb"
    | "safetyMarginGb"
    | "totalNeededGb"
    | "availableGb"
    | "missingGb"
  >
): BackupDiskSpaceReport {
  return {
    ...partial,
    databaseEstimateGb: bytesToGib(partial.databaseEstimateBytes),
    publicDirectoryGb: bytesToGib(partial.publicDirectoryBytes),
    zipEstimateGb: bytesToGib(partial.zipEstimateBytes),
    requiredGb: bytesToGib(partial.requiredBytes),
    safetyMarginGb: bytesToGib(partial.safetyMarginBytes),
    totalNeededGb: bytesToGib(partial.totalNeeded),
    availableGb: bytesToGib(partial.availableBytes),
    missingGb: bytesToGib(partial.missingBytes)
  };
}

function ceilPositive(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.ceil(n);
}

export async function checkBackupDiskSpace(): Promise<BackupDiskSpaceReport> {
  let databaseBytes: number;
  let publicDirectoryBytes: number;
  let availableBytes: number;

  try {
    [databaseBytes, publicDirectoryBytes, availableBytes] = await Promise.all([
      estimateDatabaseSizeBytes(),
      estimatePublicDirectoryBytes(),
      getFilesystemAvailableBytes()
    ]);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith("BACKUP_DISK_SPACE_ESTIMATE_FAILED")) {
      throw new AppError(
        "BACKUP_DISK_SPACE_ESTIMATE_FAILED",
        503,
        "Não foi possível estimar o espaço necessário para o backup. Tente novamente ou verifique permissões em public/ e na base de dados."
      );
    }
    if (msg === "BACKUP_DISK_SPACE_CHECK_UNAVAILABLE") {
      throw new AppError(
        "BACKUP_DISK_SPACE_CHECK_UNAVAILABLE",
        503,
        "Não foi possível verificar o espaço livre no disco do servidor."
      );
    }
    throw err;
  }

  const databaseEstimateBytes = ceilPositive(databaseBytes * DB_SIZE_FACTOR);
  const zipEstimateBytes = ceilPositive(
    ZIP_SIZE_FACTOR * (databaseEstimateBytes + publicDirectoryBytes)
  );
  const requiredBytes =
    databaseEstimateBytes + publicDirectoryBytes + zipEstimateBytes;
  const safetyMarginBytes = ceilPositive(requiredBytes * SAFETY_MARGIN_RATIO);
  const totalNeeded = requiredBytes + safetyMarginBytes;
  const missingBytes = Math.max(0, totalNeeded - availableBytes);

  return withGibFields({
    databaseBytes,
    databaseEstimateBytes,
    publicDirectoryBytes,
    zipEstimateBytes,
    requiredBytes,
    safetyMarginBytes,
    totalNeeded,
    availableBytes,
    missingBytes,
    sufficient: missingBytes === 0
  });
}

function diskSpaceErrorPayload(report: BackupDiskSpaceReport): Record<string, number> {
  return {
    requiredBytes: report.requiredBytes,
    availableBytes: report.availableBytes,
    safetyMarginBytes: report.safetyMarginBytes,
    missingBytes: report.missingBytes,
    totalNeeded: report.totalNeeded,
    databaseEstimateBytes: report.databaseEstimateBytes,
    publicDirectoryBytes: report.publicDirectoryBytes,
    zipEstimateBytes: report.zipEstimateBytes
  };
}

/**
 * Garante espaço livre para gerar backup (manual, automático ou pre_restore).
 */
export async function assertBackupDiskSpaceAvailable(): Promise<BackupDiskSpaceReport> {
  const report = await checkBackupDiskSpace();
  if (report.sufficient) return report;

  throw new AppError(
    "BACKUP_INSUFFICIENT_DISK_SPACE",
    507,
    "Espaço em disco insuficiente para concluir o backup com segurança.",
    diskSpaceErrorPayload(report)
  );
}
