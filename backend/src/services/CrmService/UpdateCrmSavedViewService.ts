import { Op } from "sequelize";
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

export default async function UpdateCrmSavedViewService(input: {
  companyId: number;
  id: number;
  requesterId: number | null;
  requesterProfile?: string;
  requesterSupportMode?: boolean;
  name?: string;
  filters?: unknown;
  isDefault?: boolean;
}): Promise<CrmSavedView> {
  const row = await CrmSavedView.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!row) {
    throw new AppError("ERR_CRM_SAVED_VIEW_NOT_FOUND", 404);
  }

  const isAdmin =
    input.requesterProfile === "admin" || input.requesterSupportMode === true;
  const isCreator =
    input.requesterId != null &&
    row.createdBy != null &&
    Number(row.createdBy) === Number(input.requesterId);

  if (!isAdmin && !isCreator) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  return sequelize.transaction(async (t) => {
    if (input.name !== undefined) {
      const name = String(input.name || "").trim();
      if (!name || name.length > 120) {
        throw new AppError("ERR_VALIDATION", 400);
      }
      row.name = name;
    }
    if (input.filters !== undefined) {
      row.filters = assertFiltersShape(input.filters);
    }
    if (input.isDefault !== undefined) {
      const isDefault = Boolean(input.isDefault);
      if (isDefault) {
        await CrmSavedView.update(
          { isDefault: false },
          {
            where: { companyId: input.companyId, id: { [Op.ne]: row.id } },
            transaction: t
          }
        );
      }
      row.isDefault = isDefault;
    }

    await row.save({ transaction: t });
    return row;
  });
}
