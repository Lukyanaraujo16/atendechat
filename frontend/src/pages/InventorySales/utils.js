export function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse de quantidade (API DECIMAL, string "1.000", vírgula pt-BR).
 * NÃO trata ponto como milhar — "1.000" é 1 com 3 casas, não mil.
 */
export function parseQuantityValue(value) {
  if (value === "" || value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  // Aceita "1,5" na digitação; ponto é decimal (DECIMAL Sequelize), não milhar.
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Valor canônico para input editável (ponto decimal, sem zeros à direita).
 * "1.000" → "1"; "1.500" → "1.5"; 1000 → "1000".
 */
export function normalizeQuantityInputValue(value) {
  if (value === "" || value == null) return "";
  const n = parseQuantityValue(value);
  if (n == null) return String(value);
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(3)));
}

export function quantityValuesEqual(left, right) {
  const a = parseQuantityValue(left);
  const b = parseQuantityValue(right);
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.round(a * 1000) === Math.round(b * 1000);
}

export function isProductLowStock(product) {
  if (!product?.trackStock || product.minStock == null) return false;
  return toNumber(product.currentQuantity) <= toNumber(product.minStock);
}

/**
 * Exibição de quantidade (pt-BR, sem agrupamento de milhar).
 * 1 → "1"; 1.5 → "1,5"; 1000 → "1000" (nunca "1.000").
 */
export function formatQuantity(value) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("pt-BR", {
    useGrouping: false,
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
