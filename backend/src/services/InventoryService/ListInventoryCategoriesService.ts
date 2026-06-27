import InventoryCategory from "../../models/InventoryCategory";
import { parseBooleanQuery } from "./inventoryTenant";

export default async function ListInventoryCategoriesService(input: {
  companyId: number;
  active?: unknown;
}): Promise<InventoryCategory[]> {
  const where: Record<string, unknown> = { companyId: input.companyId };
  const active = parseBooleanQuery(input.active);
  if (active !== undefined) {
    where.active = active;
  }

  return InventoryCategory.findAll({
    where,
    order: [
      ["position", "ASC"],
      ["name", "ASC"]
    ],
    include: [
      {
        model: InventoryCategory,
        as: "parent",
        attributes: ["id", "name"],
        required: false
      }
    ]
  });
}
