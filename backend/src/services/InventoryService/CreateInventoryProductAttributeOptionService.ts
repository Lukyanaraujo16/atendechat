import AppError from "../../errors/AppError";
import InventoryProductAttribute from "../../models/InventoryProductAttribute";
import InventoryProductAttributeOption from "../../models/InventoryProductAttributeOption";
import { normalizeOptionalString } from "./inventoryTenant";

export default async function CreateInventoryProductAttributeOptionService(input: {
  companyId: number;
  attributeId: number;
  body: { value?: unknown; position?: unknown };
}): Promise<InventoryProductAttributeOption> {
  const attribute = await InventoryProductAttribute.findOne({
    where: { id: input.attributeId, companyId: input.companyId }
  });
  if (!attribute) {
    throw new AppError("ERR_INVENTORY_ATTRIBUTE_NOT_FOUND", 404);
  }
  const value = normalizeOptionalString(input.body.value, 120);
  if (!value) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Valor da opção obrigatório.");
  }
  const position = Number(input.body.position);
  try {
    return await InventoryProductAttributeOption.create({
      companyId: input.companyId,
      attributeId: attribute.id,
      value,
      position: Number.isFinite(position) ? position : 0,
      active: true
    });
  } catch (err) {
    const msg = String((err as { message?: string })?.message || "");
    if (msg.includes("InventoryProductAttributeOptions_company_attr_value")) {
      throw new AppError("ERR_INVENTORY_ATTRIBUTE_OPTION_DUPLICATE", 400);
    }
    throw err;
  }
}
