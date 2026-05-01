import Company from "../../models/Company";
import Plan from "../../models/Plan";
import AppError from "../../errors/AppError";
import {
  computeStorageUsagePercent,
  formatBytesPtBr,
  getCompanyStorageLimitBytes,
  resolveStorageAlertLevel
} from "../../helpers/companyStorage";

export type TenantStorageResponse = {
  usedBytes: number;
  limitBytes: number | null;
  usedFormatted: string;
  limitFormatted: string | null;
  remainingFormatted: string | null;
  percent: number | null;
  calculatedAt: string | null;
  alertLevel: ReturnType<typeof resolveStorageAlertLevel>;
};

const GetMyCompanyStorageService = async (
  companyId: number
): Promise<TenantStorageResponse> => {
  const company = await Company.findByPk(companyId, {
    attributes: [
      "id",
      "storageUsedBytes",
      "storageLimitGb",
      "storageCalculatedAt"
    ],
    include: [
      {
        model: Plan,
        as: "plan",
        attributes: ["id", "storageLimitGb"],
        required: false
      }
    ]
  });

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const row = company.toJSON() as Record<string, unknown>;
  const plan = row.plan as { storageLimitGb?: unknown } | undefined;
  const used = Number(row.storageUsedBytes ?? 0);
  const limitBytes = getCompanyStorageLimitBytes(
    { storageLimitGb: row.storageLimitGb },
    plan || null
  );
  const percent = computeStorageUsagePercent(used, limitBytes);
  const remaining =
    limitBytes !== null ? Math.max(0, limitBytes - used) : null;

  return {
    usedBytes: used,
    limitBytes,
    usedFormatted: formatBytesPtBr(used),
    limitFormatted: limitBytes !== null ? formatBytesPtBr(limitBytes) : null,
    remainingFormatted:
      remaining !== null ? formatBytesPtBr(remaining) : null,
    percent,
    calculatedAt: row.storageCalculatedAt
      ? new Date(String(row.storageCalculatedAt)).toISOString()
      : null,
    alertLevel: resolveStorageAlertLevel(percent)
  };
};

export default GetMyCompanyStorageService;
