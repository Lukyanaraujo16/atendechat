import sequelize from "../../database";
import CrmSavedView from "../../models/CrmSavedView";
import AppError from "../../errors/AppError";

const MAX_FILTERS_JSON = 48_000;

function assertFiltersShape(filters: unknown): Record<string, unknown> {
  if (filters == null || typeof filters !== "object" || Array.isArray(filters)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const raw = JSON.stringify(filters);
  if (raw.length > MAX_FILTERS_JSON) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  return filters as Record<string, unknown>;
}

export default async function CreateCrmSavedViewService(input: {
  companyId: number;
  userId: number | null;
  name: string;
  filters: unknown;
  isDefault?: boolean;
}): Promise<CrmSavedView> {
  const name = String(input.name || "").trim();
  if (!name || name.length > 120) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const filters = assertFiltersShape(input.filters);
  const isDefault = Boolean(input.isDefault);

  return sequelize.transaction(async (t) => {
    if (isDefault) {
      await CrmSavedView.update(
        { isDefault: false },
        { where: { companyId: input.companyId }, transaction: t }
      );
    }
    return CrmSavedView.create(
      {
        companyId: input.companyId,
        name,
        filters,
        isDefault,
        createdBy: input.userId ?? null
      },
      { transaction: t }
    );
  });
}
