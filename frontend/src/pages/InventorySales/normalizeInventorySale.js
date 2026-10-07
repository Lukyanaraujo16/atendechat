/**
 * Normaliza o shape da venda para UI de recibo/itens.
 * Aceita `items`, alias Sequelize `InventorySaleItems` e `rows`.
 */

function unwrapRow(row) {
  if (!row || typeof row !== "object") return null;
  if (row.dataValues && typeof row.dataValues === "object") {
    return { ...row.dataValues, ...row };
  }
  return row;
}

function normalizeSaleItem(raw) {
  const row = unwrapRow(raw);
  if (!row) return null;
  const product = unwrapRow(row.product) || row.product || null;
  const identifiers = Array.isArray(row.identifiers)
    ? row.identifiers
    : Array.isArray(row.InventorySaleItemIdentifiers)
      ? row.InventorySaleItemIdentifiers
      : [];
  return {
    ...row,
    id: row.id,
    productName: row.productName || product?.name || "",
    productSku: row.productSku != null ? row.productSku : product?.sku ?? null,
    unit: row.unit,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    discountAmount: row.discountAmount,
    totalAmount: row.totalAmount,
    product,
    identifiers,
  };
}

function coerceItemsList(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray(raw.rows)) return raw.rows;
  return null;
}

export function getInventorySaleItems(sale) {
  if (!sale || typeof sale !== "object") return [];
  const raw =
    coerceItemsList(sale.items) ||
    coerceItemsList(sale.InventorySaleItems) ||
    coerceItemsList(sale.inventorySaleItems) ||
    [];
  return raw.map(normalizeSaleItem).filter(Boolean);
}

export function normalizeInventorySale(sale) {
  if (!sale || typeof sale !== "object") return sale;
  return {
    ...sale,
    items: getInventorySaleItems(sale),
  };
}
