import InventoryProductVariant from "../../models/InventoryProductVariant";
import InventoryProductVariantOption from "../../models/InventoryProductVariantOption";
import InventoryProductAttribute from "../../models/InventoryProductAttribute";
import InventoryProductAttributeOption from "../../models/InventoryProductAttributeOption";
import { findInventoryProductOrThrow } from "./inventoryTenant";

export default async function ListInventoryProductVariantsService(input: {
  companyId: number;
  productId: number;
  active?: boolean | null;
}): Promise<InventoryProductVariant[]> {
  await findInventoryProductOrThrow(input.companyId, input.productId);
  const where: Record<string, unknown> = {
    companyId: input.companyId,
    productId: input.productId
  };
  if (input.active === true || input.active === false) {
    where.active = input.active;
  }
  return InventoryProductVariant.findAll({
    where,
    include: [
      {
        model: InventoryProductVariantOption,
        as: "optionLinks",
        include: [
          {
            model: InventoryProductAttribute,
            as: "attribute",
            attributes: ["id", "name", "position"]
          },
          {
            model: InventoryProductAttributeOption,
            as: "option",
            attributes: ["id", "value", "position"]
          }
        ]
      }
    ],
    order: [
      ["active", "DESC"],
      ["label", "ASC"],
      ["id", "ASC"]
    ]
  });
}
