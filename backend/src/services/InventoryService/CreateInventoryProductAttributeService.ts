import AppError from "../../errors/AppError";
import InventoryProductAttribute from "../../models/InventoryProductAttribute";
import { normalizeOptionalString } from "./inventoryTenant";

export default async function CreateInventoryProductAttributeService(input: {
  companyId: number;
  body: { name?: unknown; position?: unknown };
}): Promise<InventoryProductAttribute> {
  const name = normalizeOptionalString(input.body.name, 80);
  if (!name) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Nome do atributo obrigatório.");
  }
  const position = Number(input.body.position);
  try {
    return await InventoryProductAttribute.create({
      companyId: input.companyId,
      name,
      position: Number.isFinite(position) ? position : 0,
      active: true
    });
  } catch (err) {
    const msg = String((err as { message?: string })?.message || "");
    if (msg.includes("InventoryProductAttributes_companyId_name")) {
      throw new AppError("ERR_INVENTORY_ATTRIBUTE_NAME_DUPLICATE", 400);
    }
    throw err;
  }
}
