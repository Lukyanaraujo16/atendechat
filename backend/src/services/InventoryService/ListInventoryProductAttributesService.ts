import InventoryProductAttribute from "../../models/InventoryProductAttribute";
import InventoryProductAttributeOption from "../../models/InventoryProductAttributeOption";

export default async function ListInventoryProductAttributesService(input: {
  companyId: number;
  activeOnly?: boolean;
}): Promise<InventoryProductAttribute[]> {
  const where: Record<string, unknown> = { companyId: input.companyId };
  if (input.activeOnly) where.active = true;
  return InventoryProductAttribute.findAll({
    where,
    include: [
      {
        model: InventoryProductAttributeOption,
        where: input.activeOnly ? { active: true } : undefined,
        required: false
      }
    ],
    order: [
      ["position", "ASC"],
      ["name", "ASC"],
      ["id", "ASC"]
    ]
  });
}
