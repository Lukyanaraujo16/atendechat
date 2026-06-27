import AppError from "../../errors/AppError";
import InventoryCategory from "../../models/InventoryCategory";
import {
  assertInventoryCategoryNameUnique,
  assertInventoryCategoryParentValid,
  findInventoryCategoryOrThrow,
  normalizeOptionalString
} from "./inventoryTenant";

type UpdateBody = {
  name?: unknown;
  description?: unknown;
  parentId?: unknown;
  position?: unknown;
  active?: unknown;
};

export default async function UpdateInventoryCategoryService(input: {
  companyId: number;
  id: number;
  body: UpdateBody;
}): Promise<InventoryCategory> {
  const category = await findInventoryCategoryOrThrow(input.companyId, input.id);
  const patch: Partial<InventoryCategory> = {};

  let nextParentId = category.parentId;
  if (input.body.parentId !== undefined) {
    if (input.body.parentId === null || input.body.parentId === "") {
      nextParentId = null;
    } else {
      nextParentId = Number(input.body.parentId);
      if (!Number.isFinite(nextParentId)) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "parentId inválido.");
      }
    }
    await assertInventoryCategoryParentValid(
      input.companyId,
      nextParentId,
      category.id
    );
    patch.parentId = nextParentId;
  }

  let nextName = category.name;
  if (input.body.name !== undefined) {
    const name = normalizeOptionalString(input.body.name, 120);
    if (!name) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "Nome da categoria é obrigatório.");
    }
    nextName = name;
    patch.name = name;
  }

  await assertInventoryCategoryNameUnique(
    input.companyId,
    nextName,
    nextParentId,
    category.id
  );

  if (input.body.description !== undefined) {
    patch.description = normalizeOptionalString(input.body.description);
  }

  if (input.body.position !== undefined) {
    const position = Number(input.body.position);
    if (!Number.isFinite(position)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "position inválido.");
    }
    patch.position = Math.trunc(position);
  }

  if (input.body.active !== undefined) {
    patch.active =
      input.body.active === true ||
      input.body.active === "true" ||
      input.body.active === 1 ||
      input.body.active === "1";
  }

  if (Object.keys(patch).length === 0) {
    return category;
  }

  await category.update(patch);
  return category.reload();
}
