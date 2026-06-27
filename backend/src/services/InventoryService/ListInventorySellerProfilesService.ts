import InventorySellerProfile from "../../models/InventorySellerProfile";
import { inventorySellerProfileIncludes } from "./inventorySellerProfileHelpers";
import { parseBooleanQuery } from "./inventoryTenant";

export default async function ListInventorySellerProfilesService(input: {
  companyId: number;
  active?: unknown;
}): Promise<InventorySellerProfile[]> {
  const where: Record<string, unknown> = { companyId: input.companyId };
  const active = parseBooleanQuery(input.active);
  if (active !== undefined) {
    where.active = active;
  }

  return InventorySellerProfile.findAll({
    where,
    order: [
      ["active", "DESC"],
      ["id", "ASC"]
    ],
    include: inventorySellerProfileIncludes
  });
}
