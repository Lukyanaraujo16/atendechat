import { Transaction } from "sequelize";
import InventoryDeliveryMethod from "../../models/InventoryDeliveryMethod";
import { DEFAULT_PICKUP_METHOD_NAME } from "./inventoryDeliveryHelpers";

/**
 * Garante idempotentemente a modalidade "Retirada na loja" por empresa.
 * Lazy por tenant — sem seed global com IDs fixos.
 */
export default async function EnsureDefaultPickupDeliveryMethodService(input: {
  companyId: number;
  transaction?: Transaction;
}): Promise<InventoryDeliveryMethod> {
  const existing = await InventoryDeliveryMethod.findOne({
    where: {
      companyId: input.companyId,
      kind: "pickup",
      name: DEFAULT_PICKUP_METHOD_NAME
    },
    transaction: input.transaction
  });
  if (existing) return existing;

  try {
    return await InventoryDeliveryMethod.create(
      {
        companyId: input.companyId,
        name: DEFAULT_PICKUP_METHOD_NAME,
        kind: "pickup",
        defaultAmount: 0,
        allowAmountOverride: false,
        requiresAddress: false,
        active: true,
        position: 0
      },
      { transaction: input.transaction }
    );
  } catch (err) {
    // Corrida: outro request pode ter criado no intervalo.
    const raced = await InventoryDeliveryMethod.findOne({
      where: {
        companyId: input.companyId,
        kind: "pickup",
        name: DEFAULT_PICKUP_METHOD_NAME
      },
      transaction: input.transaction
    });
    if (raced) return raced;
    throw err;
  }
}
