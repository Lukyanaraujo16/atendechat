import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import User from "../../models/User";
import InventorySellerProfile from "../../models/InventorySellerProfile";

export const inventorySellerProfileIncludes = [
  {
    model: User,
    as: "user",
    attributes: ["id", "name", "email"],
    required: true
  }
];

export async function findInventorySellerProfileOrThrow(
  companyId: number,
  id: number
): Promise<InventorySellerProfile> {
  const row = await InventorySellerProfile.findOne({ where: { id, companyId } });
  if (!row) {
    throw new AppError("ERR_INVENTORY_SELLER_PROFILE_NOT_FOUND", 404);
  }
  return row;
}

export function parseCommissionRate(value: unknown, required = true): number | null {
  if (value === undefined || value === null || value === "") {
    if (required) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "commissionRate é obrigatório."
      );
    }
    return null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "commissionRate inválido.");
  }
  if (n < 0 || n > 100) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "commissionRate deve estar entre 0 e 100."
    );
  }
  return Math.round(n * 100) / 100;
}

export async function assertInventorySellerUserInCompany(
  companyId: number,
  userId: number
): Promise<User> {
  const user = await User.findOne({ where: { id: userId, companyId } });
  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404, "userId inválido.");
  }
  return user;
}

export async function assertInventorySellerProfileUnique(
  companyId: number,
  userId: number,
  excludeId?: number
): Promise<void> {
  const where: Record<string, unknown> = { companyId, userId };
  if (excludeId != null) {
    where.id = { [Op.ne]: excludeId };
  }
  const existing = await InventorySellerProfile.findOne({ where });
  if (existing) {
    throw new AppError(
      "ERR_INVENTORY_SELLER_PROFILE_DUPLICATE",
      400,
      "Já existe perfil de comissão para este vendedor."
    );
  }
}
