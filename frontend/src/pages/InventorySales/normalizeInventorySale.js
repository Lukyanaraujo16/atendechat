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
    discountType: row.discountType ?? null,
    discountPercent: row.discountPercent ?? null,
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

function unwrapDelivery(sale) {
  if (!sale || typeof sale !== "object") return null;
  const raw = sale.delivery || sale.InventorySaleDelivery || null;
  if (!raw || typeof raw !== "object") return null;
  if (raw.dataValues && typeof raw.dataValues === "object") {
    return { ...raw.dataValues, ...raw };
  }
  return raw;
}

export function normalizeInventorySale(sale) {
  if (!sale || typeof sale !== "object") return sale;
  const delivery = unwrapDelivery(sale);
  return {
    ...sale,
    items: getInventorySaleItems(sale),
    globalDiscountType: sale.globalDiscountType ?? null,
    globalDiscountPercent: sale.globalDiscountPercent ?? null,
    globalDiscountAmount:
      sale.globalDiscountAmount != null ? sale.globalDiscountAmount : 0,
    freightAmount: sale.freightAmount != null ? sale.freightAmount : 0,
    deliveryMethodId: sale.deliveryMethodId ?? null,
    deliveryMethodName: sale.deliveryMethodName ?? null,
    deliveryKind: sale.deliveryKind ?? null,
    delivery,
  };
}
