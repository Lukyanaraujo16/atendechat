import AppError from "../../errors/AppError";
import InventorySellerProfile from "../../models/InventorySellerProfile";
import {
  assertInventorySellerProfileUnique,
  assertInventorySellerUserInCompany,
  inventorySellerProfileIncludes,
  parseCommissionRate
} from "./inventorySellerProfileHelpers";

type CreateBody = {
  userId?: unknown;
  commissionRate?: unknown;
  active?: unknown;
};

export default async function CreateInventorySellerProfileService(input: {
  companyId: number;
  body: CreateBody;
}): Promise<InventorySellerProfile> {
  const userId = Number(input.body.userId);
  if (!Number.isFinite(userId)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "userId é obrigatório.");
  }

  await assertInventorySellerUserInCompany(input.companyId, userId);
  await assertInventorySellerProfileUnique(input.companyId, userId);

  const commissionRate = parseCommissionRate(input.body.commissionRate, true)!;

  const active =
    input.body.active === undefined
      ? true
      : input.body.active === true ||
        input.body.active === "true" ||
        input.body.active === 1 ||
        input.body.active === "1";

  const profile = await InventorySellerProfile.create({
    companyId: input.companyId,
    userId,
    commissionRate,
    active
  });

  return profile.reload({ include: inventorySellerProfileIncludes });
}
