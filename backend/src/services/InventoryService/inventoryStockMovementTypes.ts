export const INVENTORY_STOCK_MOVEMENT_TYPES = [
  "in",
  "out",
  "adjustment",
  "initial"
] as const;

export type InventoryStockMovementType =
  (typeof INVENTORY_STOCK_MOVEMENT_TYPES)[number];

export function isInventoryStockMovementType(
  value: string
): value is InventoryStockMovementType {
  return (INVENTORY_STOCK_MOVEMENT_TYPES as readonly string[]).includes(value);
}
