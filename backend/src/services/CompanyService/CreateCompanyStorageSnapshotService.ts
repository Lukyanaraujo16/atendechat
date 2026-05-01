import Company from "../../models/Company";
import Plan from "../../models/Plan";
import CompanyStorageSnapshot from "../../models/CompanyStorageSnapshot";
import {
  computeStorageUsagePercent,
  getCompanyStorageLimitBytes
} from "../../helpers/companyStorage";

export type CompanyStorageSnapshotReason =
  | "manual_recalculate"
  | "scheduled_recalculate"
  | "media_increment"
  | "media_decrement"
  | "threshold_80"
  | "threshold_90"
  | "threshold_100";

type Input = {
  companyId: number;
  reason: CompanyStorageSnapshotReason;
  /** Se omitido, lê `storageUsedBytes` actual da empresa. */
  usedBytes?: number;
};

const CreateCompanyStorageSnapshotService = async (
  input: Input
): Promise<CompanyStorageSnapshot | null> => {
  const company = await Company.findByPk(input.companyId, {
    attributes: ["id", "storageUsedBytes", "storageLimitGb"],
    include: [
      {
        model: Plan,
        as: "plan",
        attributes: ["storageLimitGb"],
        required: false
      }
    ]
  });
  if (!company) {
    return null;
  }

  const row = company.toJSON() as Record<string, unknown>;
  const plan = row.plan as { storageLimitGb?: unknown } | undefined;
  const used =
    input.usedBytes !== undefined
      ? Math.round(input.usedBytes)
      : Number(row.storageUsedBytes ?? 0);
  const limitBytes = getCompanyStorageLimitBytes(
    { storageLimitGb: row.storageLimitGb },
    plan || null
  );
  const usagePercent = computeStorageUsagePercent(used, limitBytes);

  return CompanyStorageSnapshot.create({
    companyId: input.companyId,
    usedBytes: used,
    limitBytes,
    usagePercent,
    reason: input.reason
  });
};

export default CreateCompanyStorageSnapshotService;
