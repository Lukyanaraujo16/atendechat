export const PRODUCT_KIND_SIMPLE = "simple";
export const PRODUCT_KIND_VARIABLE = "variable";

export function isVariableProduct(product) {
  return product?.productKind === PRODUCT_KIND_VARIABLE;
}

export function formatSaleItemProductLabel(item) {
  if (!item?.productName) return "—";
  if (item.variantLabel) {
    return `${item.productName} — ${item.variantLabel}`;
  }
  return item.productName;
}

export function formatVariablePriceRange(product, formatCurrency) {
  if (!isVariableProduct(product)) {
    return formatCurrency(product?.salePrice);
  }
  const min = product?.priceMin;
  const max = product?.priceMax;
  if (min == null && max == null) return formatCurrency(0);
  if (min != null && max != null && Number(min) !== Number(max)) {
    return `${formatCurrency(min)} – ${formatCurrency(max)}`;
  }
  const single = min != null ? min : max;
  return formatCurrency(single);
}
