/**
 * Pré-visualização local de descontos (backend é autoritativo).
 * Espelha inventoryDiscountHelpers / recalculateInventorySaleTotals.
 */

export function roundMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function computeLineGross(unitPrice, quantity) {
  return roundMoney(Number(unitPrice) * Number(quantity));
}

export function resolveItemDiscountType(discountType) {
  if (discountType === "percentage") return "percentage";
  return "fixed";
}

export function computeItemDiscountPreview(input) {
  const lineGross = computeLineGross(input.unitPrice, input.quantity);
  const discountType = resolveItemDiscountType(input.discountType);
  let discountPercent = null;
  let discountAmount = 0;

  if (discountType === "percentage") {
    const pct = Number(input.discountPercent);
    if (Number.isFinite(pct) && pct > 0) {
      discountPercent = roundMoney(Math.min(100, Math.max(0, pct)));
      discountAmount = roundMoney((lineGross * discountPercent) / 100);
    }
  } else {
    const raw = input.discountAmount;
    discountAmount =
      raw === undefined || raw === null || raw === ""
        ? 0
        : roundMoney(Math.max(0, Number(raw)));
  }

  if (discountAmount > lineGross) {
    discountAmount = lineGross;
  }

  const lineTotal = roundMoney(Math.max(0, lineGross - discountAmount));

  return {
    discountType,
    discountPercent,
    discountAmount,
    lineGross,
    lineTotal,
  };
}

function computeGlobalDiscountPreview(globalInput, merchandiseAfterItemDiscounts) {
  const base = roundMoney(Math.max(0, merchandiseAfterItemDiscounts));
  const rawType = globalInput?.globalDiscountType;

  if (rawType == null || rawType === "") {
    return {
      globalDiscountType: null,
      globalDiscountPercent: null,
      globalDiscountAmount: 0,
      netMerchandise: base,
    };
  }

  const globalDiscountType =
    rawType === "percentage" ? "percentage" : "fixed";
  let globalDiscountPercent = null;
  let globalDiscountAmount = 0;

  if (globalDiscountType === "percentage") {
    const pct = Number(globalInput.globalDiscountPercent);
    if (Number.isFinite(pct) && pct > 0) {
      globalDiscountPercent = roundMoney(Math.min(100, Math.max(0, pct)));
      globalDiscountAmount = roundMoney((base * globalDiscountPercent) / 100);
    }
  } else {
    const raw = globalInput.globalDiscountAmount;
    globalDiscountAmount =
      raw === undefined || raw === null || raw === ""
        ? 0
        : roundMoney(Math.max(0, Number(raw)));
  }

  if (globalDiscountAmount > base) {
    globalDiscountAmount = base;
  }

  const netMerchandise = roundMoney(Math.max(0, base - globalDiscountAmount));

  return {
    globalDiscountType,
    globalDiscountPercent,
    globalDiscountAmount,
    netMerchandise,
  };
}

/**
 * Totais da venda a partir do shape `sale` (campos persistidos + frete opcional).
 */
export function computeSaleTotalsPreview(sale, options = {}) {
  const grossSubtotal = roundMoney(sale?.subtotalAmount ?? 0);
  const itemDiscountTotal = roundMoney(sale?.discountAmount ?? 0);
  const merchandiseAfterItems = roundMoney(
    grossSubtotal - itemDiscountTotal
  );

  const globalFromSale = {
    globalDiscountType: sale?.globalDiscountType,
    globalDiscountAmount: sale?.globalDiscountAmount,
    globalDiscountPercent: sale?.globalDiscountPercent,
  };
  const global = computeGlobalDiscountPreview(
    globalFromSale,
    merchandiseAfterItems
  );

  const persistedFreight = roundMoney(sale?.freightAmount ?? 0);
  const freight =
    options.previewFreightAmount != null
      ? roundMoney(options.previewFreightAmount)
      : persistedFreight;

  const backendTotal = roundMoney(sale?.totalAmount ?? 0);
  const total =
    options.previewFreightAmount != null
      ? roundMoney(global.netMerchandise + freight)
      : backendTotal;

  return {
    grossSubtotal,
    itemDiscountTotal,
    merchandiseAfterItems,
    globalDiscountAmount: global.globalDiscountAmount,
    netMerchandise: global.netMerchandise,
    freight,
    total,
  };
}
