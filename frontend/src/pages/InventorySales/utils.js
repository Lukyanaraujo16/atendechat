export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function isProductLowStock(product) {
  if (!product?.trackStock || product.minStock == null) return false;
  return toNumber(product.currentQuantity) <= toNumber(product.minStock);
}

export function formatQuantity(value) {
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

/** Sinal único: positivo ganha +, negativo um só "-", zero fica 0. */
export function formatSignedQuantity(value) {
  const n = toNumber(value);
  const body = formatQuantity(Math.abs(n));
  if (n > 0) return `+${body}`;
  if (n < 0) return `-${body}`;
  return body;
}

/**
 * Quantidade e unidade permanecem separados de minStock.
 * unit é exibido cru, inclusive quando o cadastro guardou "un50".
 */
export function describeProductStock(product) {
  if (!product?.trackStock) {
    return { status: "untracked", quantityText: "", minText: null };
  }
  const qty = toNumber(product.currentQuantity);
  const unit = typeof product.unit === "string" ? product.unit.trim() : "";
  const quantityText = unit ? `${formatQuantity(qty)} ${unit}` : formatQuantity(qty);
  const minText =
    product.minStock != null && product.minStock !== ""
      ? formatQuantity(product.minStock)
      : null;
  if (qty === 0) {
    return { status: "out", quantityText, minText };
  }
  if (isProductLowStock(product)) {
    return { status: "low", quantityText, minText };
  }
  return { status: "ok", quantityText, minText };
}

export function formatSaleNumber(sale) {
  if (!sale) return "—";
  if (sale.status === "draft") {
    return `#${sale.id}`;
  }
  const num = toNumber(sale.saleNumber);
  if (num > 0) return `#${num}`;
  return `#${sale.id}`;
}

export function getSaleDisplayDate(sale) {
  if (!sale) return null;
  if (sale.status === "completed" && sale.completedAt) return sale.completedAt;
  if (sale.status === "cancelled" && sale.cancelledAt) return sale.cancelledAt;
  return sale.createdAt;
}

export function isSaleEditable(sale) {
  return sale?.status === "draft";
}

export function paymentStatusChipColor(status) {
  if (status === "paid") return "primary";
  if (status === "partial") return "default";
  if (status === "refunded") return "default";
  return "default";
}

export function formatPaymentMethod(method) {
  if (!method) return "—";
  return method;
}
