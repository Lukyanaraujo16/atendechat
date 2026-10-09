import axios from "axios";
import { i18n } from "../../translate/i18n";
import { formatQuantity, toNumber } from "./utils";
import { isVariableProduct } from "./inventoryProductKind";

/** Mesmo corte em que o drawer deixa de ocupar 100vw (MUI sm / md = 960). */
export const SALE_SEARCH_AUTOFOCUS_QUERY = "(min-width:960px)";

export function shouldAutofocusSaleProductSearch() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(SALE_SEARCH_AUTOFOCUS_QUERY).matches;
}

/**
 * Axios 0.21 não cancela com AbortSignal. O AbortController segue o padrão da
 * página de contatos; o CancelToken faz o cancelamento valer nesta versão.
 */
export function axiosAbortConfig(controller) {
  const source = axios.CancelToken.source();
  const { signal } = controller;
  if (signal.aborted) {
    source.cancel("aborted");
  } else {
    signal.addEventListener("abort", () => source.cancel("aborted"));
  }
  return { signal, cancelToken: source.token };
}

export function isAbortError(err) {
  if (!err) return false;
  if (axios.isCancel(err)) return true;
  if (err.code === "ERR_CANCELED" || err.name === "CanceledError" || err.name === "AbortError") {
    return true;
  }
  return false;
}

/**
 * Comparação estrita, depois do trim do termo. Não altera caixa.
 * Vários barcodes ou SKUs iguais não escolhem um produto.
 * Barcode tem prioridade sobre SKU quando há exatamente um de cada.
 */
export function pickExactSaleProduct(products, term) {
  const query = String(term ?? "").trim();
  if (!query || !Array.isArray(products)) return null;

  const barcodeHits = products.filter(
    (product) => typeof product?.barcode === "string" && product.barcode === query
  );
  if (barcodeHits.length === 1) return barcodeHits[0];
  if (barcodeHits.length > 1) return null;

  const skuHits = products.filter(
    (product) => typeof product?.sku === "string" && product.sku === query
  );
  if (skuHits.length === 1) return skuHits[0];

  const variantCodeHits = products.filter(
    (product) => product?.selectedVariant != null
  );
  if (variantCodeHits.length === 1) return variantCodeHits[0];
  return null;
}

export function saleProductStockLabel(product) {
  if (isVariableProduct(product) && !product?.selectedVariant) {
    const qty = toNumber(product.aggregatedQuantity ?? product.currentQuantity);
    const unit = typeof product.unit === "string" ? product.unit.trim() : "";
    const quantityText = unit ? `${formatQuantity(qty)} ${unit}` : formatQuantity(qty);
    return i18n.t("inventorySales.sales.items.search.variantAggregateStock", {
      quantity: quantityText,
    });
  }
  if (!product?.trackStock) {
    return i18n.t("inventorySales.sales.items.search.untracked");
  }
  const qty = toNumber(product.currentQuantity);
  if (qty <= 0) {
    return i18n.t("inventorySales.sales.items.search.outOfStock");
  }
  const unit = typeof product.unit === "string" ? product.unit.trim() : "";
  const quantityText = unit ? `${formatQuantity(qty)} ${unit}` : formatQuantity(qty);
  return i18n.t("inventorySales.sales.items.search.stock", { quantity: quantityText });
}

export function saleProductShowsBarcode(product, query) {
  const code = typeof product?.barcode === "string" ? product.barcode : "";
  const q = String(query ?? "").trim();
  if (!code || !q) return false;
  return code === q || code.includes(q);
}
