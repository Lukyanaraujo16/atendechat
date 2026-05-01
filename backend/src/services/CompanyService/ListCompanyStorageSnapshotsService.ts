import CompanyStorageSnapshot from "../../models/CompanyStorageSnapshot";

const ListCompanyStorageSnapshotsService = async (
  companyId: number,
  limit = 30
): Promise<CompanyStorageSnapshot[]> => {
  return CompanyStorageSnapshot.findAll({
    where: { companyId },
    order: [["createdAt", "DESC"]],
    limit: Math.min(Math.max(limit, 1), 100),
    attributes: [
      "id",
      "companyId",
      "usedBytes",
      "limitBytes",
      "usagePercent",
      "reason",
      "createdAt"
    ]
  });
};

export default ListCompanyStorageSnapshotsService;
