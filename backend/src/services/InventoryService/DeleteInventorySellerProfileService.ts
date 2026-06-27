import {
  findInventorySellerProfileOrThrow,
  inventorySellerProfileIncludes
} from "./inventorySellerProfileHelpers";
import InventorySellerProfile from "../../models/InventorySellerProfile";

/** Soft delete — preserva histórico; vendas concluídas mantêm snapshot de comissão. */
export default async function DeleteInventorySellerProfileService(input: {
  companyId: number;
  id: number;
}): Promise<InventorySellerProfile> {
  const profile = await findInventorySellerProfileOrThrow(input.companyId, input.id);
  await profile.update({ active: false });
  return profile.reload({ include: inventorySellerProfileIncludes });
}
