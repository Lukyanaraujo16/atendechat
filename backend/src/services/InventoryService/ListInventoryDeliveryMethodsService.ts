import InventoryDeliveryMethod from "../../models/InventoryDeliveryMethod";
import { parseBooleanQuery } from "./inventoryTenant";
import EnsureDefaultPickupDeliveryMethodService from "./EnsureDefaultPickupDeliveryMethodService";

export default async function ListInventoryDeliveryMethodsService(input: {
  companyId: number;
  active?: unknown;
  ensureDefaultPickup?: boolean;
}): Promise<InventoryDeliveryMethod[]> {
  if (input.ensureDefaultPickup !== false) {
    await EnsureDefaultPickupDeliveryMethodService({
      companyId: input.companyId
    });
  }

  const active = parseBooleanQuery(input.active);
  const where: Record<string, unknown> = { companyId: input.companyId };
  if (active !== undefined) {
    where.active = active;
  }

  return InventoryDeliveryMethod.findAll({
    where,
    order: [
      ["position", "ASC"],
      ["id", "ASC"]
    ]
  });
}
