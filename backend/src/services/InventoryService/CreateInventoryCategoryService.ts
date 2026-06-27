import AppError from "../../errors/AppError";
import InventoryCategory from "../../models/InventoryCategory";
import {
  assertInventoryCategoryNameUnique,
  assertInventoryCategoryParentValid,
  normalizeOptionalString
} from "./inventoryTenant";

type CreateBody = {
  name?: unknown;
  description?: unknown;
  parentId?: unknown;
  position?: unknown;
  active?: unknown;
};

export default async function CreateInventoryCategoryService(input: {
  companyId: number;
  body: CreateBody;
}): Promise<InventoryCategory> {
  const name = normalizeOptionalString(input.body.name, 120);
  if (!name) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Nome da categoria é obrigatório.");
  }

  let parentId: number | null = null;
  if (
    input.body.parentId !== undefined &&
    input.body.parentId !== null &&
    input.body.parentId !== ""
  ) {
    parentId = Number(input.body.parentId);
    if (!Number.isFinite(parentId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "parentId inválido.");
    }
  }

  await assertInventoryCategoryParentValid(input.companyId, parentId);
  await assertInventoryCategoryNameUnique(input.companyId, name, parentId);

  const position =
    input.body.position !== undefined && input.body.position !== null
      ? Number(input.body.position)
      : 0;
  if (!Number.isFinite(position)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "position inválido.");
  }

  const active =
    input.body.active === undefined
      ? true
      : input.body.active === true ||
        input.body.active === "true" ||
        input.body.active === 1 ||
        input.body.active === "1";

  return InventoryCategory.create({
    companyId: input.companyId,
    name,
    description: normalizeOptionalString(input.body.description),
    parentId,
    position: Math.trunc(position),
    active
  });
}
