import Company from "../../models/Company";
import AppError from "../../errors/AppError";
import CalculateCompanyStorageUsageService from "./CalculateCompanyStorageUsageService";
import CreateCompanyStorageSnapshotService, {
  type CompanyStorageSnapshotReason
} from "./CreateCompanyStorageSnapshotService";
import {
  setCompanyStorageUsage,
  evaluateCompanyStorageThresholds
} from "./adjustCompanyStorageUsage";
import { logger } from "../../utils/logger";

const RecalculateCompanyStorageUsageService = async (
  companyId: number,
  options?: { snapshotReason?: CompanyStorageSnapshotReason }
): Promise<{ usedBytes: number; calculatedAt: Date }> => {
  const company = await Company.findByPk(companyId, { attributes: ["id"] });
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const usedBytes = await CalculateCompanyStorageUsageService(companyId);
  try {
    await setCompanyStorageUsage(companyId, usedBytes);
  } catch (err) {
    logger.error(
      {
        companyId,
        usedBytes,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      },
      "[CompanyStorage] setCompanyStorageUsage_failed"
    );
  }

  const snapshotReason: CompanyStorageSnapshotReason =
    options?.snapshotReason ?? "manual_recalculate";
  try {
    await CreateCompanyStorageSnapshotService({
      companyId,
      reason: snapshotReason,
      usedBytes
    });
  } catch (err) {
    logger.warn(
      {
        companyId,
        usedBytes,
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyStorage] snapshot_failed"
    );
  }

  try {
    await evaluateCompanyStorageThresholds(companyId);
  } catch (err) {
    logger.warn(
      {
        companyId,
        usedBytes,
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyStorage] thresholds_failed"
    );
  }

  const refreshed = await Company.findByPk(companyId, {
    attributes: ["storageCalculatedAt"]
  });
  const calculatedAt =
    refreshed?.storageCalculatedAt != null
      ? new Date(refreshed.storageCalculatedAt)
      : new Date();

  return { usedBytes, calculatedAt };
};

export default RecalculateCompanyStorageUsageService;
