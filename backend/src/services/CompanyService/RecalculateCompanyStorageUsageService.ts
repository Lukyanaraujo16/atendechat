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

const RecalculateCompanyStorageUsageService = async (
  companyId: number,
  options?: { snapshotReason?: CompanyStorageSnapshotReason }
): Promise<{ usedBytes: number; calculatedAt: Date }> => {
  const company = await Company.findByPk(companyId, { attributes: ["id"] });
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const usedBytes = await CalculateCompanyStorageUsageService(companyId);
  await setCompanyStorageUsage(companyId, usedBytes);

  const snapshotReason: CompanyStorageSnapshotReason =
    options?.snapshotReason ?? "manual_recalculate";
  await CreateCompanyStorageSnapshotService({
    companyId,
    reason: snapshotReason
  });

  await evaluateCompanyStorageThresholds(companyId);

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
