import AppError from "../../errors/AppError";
import InventoryDeliveryMethod from "../../models/InventoryDeliveryMethod";

/** Soft delete — preserva histórico de vendas com snapshot. */
export default async function DeactivateInventoryDeliveryMethodService(input: {
  companyId: number;
  id: number;
}): Promise<InventoryDeliveryMethod> {
  const method = await InventoryDeliveryMethod.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!method) {
    throw new AppError("ERR_INVENTORY_DELIVERY_METHOD_NOT_FOUND", 404);
  }
  await method.update({ active: false });
  return method.reload();
}
