import InventorySellerProfile from "../../models/InventorySellerProfile";
import {
  findInventorySellerProfileOrThrow,
  inventorySellerProfileIncludes,
  parseCommissionRate
} from "./inventorySellerProfileHelpers";

type UpdateBody = {
  commissionRate?: unknown;
  active?: unknown;
};

export default async function UpdateInventorySellerProfileService(input: {
  companyId: number;
  id: number;
  body: UpdateBody;
}): Promise<InventorySellerProfile> {
  const profile = await findInventorySellerProfileOrThrow(input.companyId, input.id);
  const patch: Partial<InventorySellerProfile> = {};

  if (input.body.commissionRate !== undefined) {
    patch.commissionRate = parseCommissionRate(input.body.commissionRate, true)!;
  }

  if (input.body.active !== undefined) {
    patch.active =
      input.body.active === true ||
      input.body.active === "true" ||
      input.body.active === 1 ||
      input.body.active === "1";
  }

  if (Object.keys(patch).length === 0) {
    return profile.reload({ include: inventorySellerProfileIncludes });
  }

  await profile.update(patch);
  return profile.reload({ include: inventorySellerProfileIncludes });
}
