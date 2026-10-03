/** Tipos aceitos no POST manual. Venda e estorno não entram. */
export const MANUAL_INVENTORY_STOCK_MOVEMENT_TYPES = [
  "in",
  "out",
  "adjustment",
  "initial"
] as const;

/** Tipos que a listagem pode filtrar, inclusive os gerados por venda. */
export const LISTABLE_INVENTORY_STOCK_MOVEMENT_TYPES = [
  ...MANUAL_INVENTORY_STOCK_MOVEMENT_TYPES,
  "sale",
  "sale_reversal"
] as const;

/** Alias histórico: continua sendo a whitelist do POST manual. */
export const INVENTORY_STOCK_MOVEMENT_TYPES =
  MANUAL_INVENTORY_STOCK_MOVEMENT_TYPES;

export type InventoryStockMovementType =
  (typeof MANUAL_INVENTORY_STOCK_MOVEMENT_TYPES)[number];

export type ListableInventoryStockMovementType =
  (typeof LISTABLE_INVENTORY_STOCK_MOVEMENT_TYPES)[number];

export function isInventoryStockMovementType(
  value: string
): value is InventoryStockMovementType {
  return (MANUAL_INVENTORY_STOCK_MOVEMENT_TYPES as readonly string[]).includes(
    value
  );
}

export function isListableInventoryStockMovementType(
  value: string
): value is ListableInventoryStockMovementType {
  return (
    LISTABLE_INVENTORY_STOCK_MOVEMENT_TYPES as readonly string[]
  ).includes(value);
}
