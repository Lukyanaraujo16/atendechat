export const INVENTORY_PRODUCT_KIND_SIMPLE = "simple";
export const INVENTORY_PRODUCT_KIND_VARIABLE = "variable";

export type InventoryProductKind =
  | typeof INVENTORY_PRODUCT_KIND_SIMPLE
  | typeof INVENTORY_PRODUCT_KIND_VARIABLE;

export function normalizeInventoryProductKind(
  value: unknown
): InventoryProductKind {
  const raw = String(value ?? INVENTORY_PRODUCT_KIND_SIMPLE)
    .trim()
    .toLowerCase();
  if (raw === INVENTORY_PRODUCT_KIND_VARIABLE) {
    return INVENTORY_PRODUCT_KIND_VARIABLE;
  }
  return INVENTORY_PRODUCT_KIND_SIMPLE;
}

export function isVariableProduct(product: { productKind?: string | null }): boolean {
  return normalizeInventoryProductKind(product?.productKind) ===
    INVENTORY_PRODUCT_KIND_VARIABLE;
}

export function isSimpleProduct(product: { productKind?: string | null }): boolean {
  return !isVariableProduct(product);
}
