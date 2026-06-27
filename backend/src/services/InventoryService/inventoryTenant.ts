import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryCategory from "../../models/InventoryCategory";
import InventoryProduct from "../../models/InventoryProduct";

export async function findInventoryCategoryOrThrow(
  companyId: number,
  id: number
): Promise<InventoryCategory> {
  const row = await InventoryCategory.findOne({ where: { id, companyId } });
  if (!row) {
    throw new AppError("ERR_INVENTORY_CATEGORY_NOT_FOUND", 404);
  }
  return row;
}

export async function findInventoryProductOrThrow(
  companyId: number,
  id: number
): Promise<InventoryProduct> {
  const row = await InventoryProduct.findOne({ where: { id, companyId } });
  if (!row) {
    throw new AppError("ERR_INVENTORY_PRODUCT_NOT_FOUND", 404);
  }
  return row;
}

export async function assertInventoryCategoryParentValid(
  companyId: number,
  parentId: number | null | undefined,
  excludeCategoryId?: number
): Promise<void> {
  if (parentId == null) return;
  const parent = await InventoryCategory.findOne({
    where: { id: parentId, companyId }
  });
  if (!parent) {
    throw new AppError("ERR_INVENTORY_CATEGORY_PARENT_NOT_FOUND", 404);
  }
  if (excludeCategoryId != null && parentId === excludeCategoryId) {
    throw new AppError("ERR_INVENTORY_CATEGORY_INVALID_PARENT", 400);
  }
}

export async function assertInventoryCategoryNameUnique(
  companyId: number,
  name: string,
  parentId: number | null,
  excludeId?: number
): Promise<void> {
  const where: Record<string, unknown> = {
    companyId,
    name,
    parentId: parentId ?? null
  };
  if (excludeId != null) {
    where.id = { [Op.ne]: excludeId };
  }
  const existing = await InventoryCategory.findOne({ where });
  if (existing) {
    throw new AppError("ERR_INVENTORY_CATEGORY_NAME_DUPLICATE", 400);
  }
}

export async function assertInventoryProductSkuUnique(
  companyId: number,
  sku: string | null | undefined,
  excludeId?: number
): Promise<void> {
  const trimmed = sku?.trim();
  if (!trimmed) return;
  const where: Record<string, unknown> = { companyId, sku: trimmed };
  if (excludeId != null) {
    where.id = { [Op.ne]: excludeId };
  }
  const existing = await InventoryProduct.findOne({ where });
  if (existing) {
    throw new AppError("ERR_INVENTORY_PRODUCT_SKU_DUPLICATE", 400);
  }
}

export async function assertInventoryCategoryBelongsToCompany(
  companyId: number,
  categoryId: number | null | undefined
): Promise<void> {
  if (categoryId == null) return;
  const cat = await InventoryCategory.findOne({
    where: { id: categoryId, companyId }
  });
  if (!cat) {
    throw new AppError("ERR_INVENTORY_CATEGORY_NOT_FOUND", 404);
  }
}

export function normalizeOptionalString(
  value: unknown,
  maxLen?: number
): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  if (maxLen != null && t.length > maxLen) {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }
  return t;
}

export function parseBooleanQuery(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return undefined;
}

export function parseDecimal(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, `Valor inválido: ${field}`);
  }
  return n;
}

export function parseRequiredDecimal(value: unknown, field: string): number {
  const n = parseDecimal(value, field);
  if (n === null) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, `Campo obrigatório: ${field}`);
  }
  return n;
}

export function toInventoryQuantity(value: string | number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parsePaginationQuery(
  pageRaw: unknown,
  limitRaw: unknown
): { page: number; limit: number; offset: number } {
  const page = Math.max(1, Math.trunc(Number(pageRaw) || 1));
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(limitRaw) || 20)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function parseOptionalDateQuery(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Data inválida.");
  }
  return d;
}
