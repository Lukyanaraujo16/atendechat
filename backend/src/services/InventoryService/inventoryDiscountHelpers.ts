import AppError from "../../errors/AppError";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export type InventoryDiscountType = "fixed" | "percentage";

export function normalizeDiscountType(
  value: unknown,
  options: { allowNullLegacy?: boolean } = {}
): InventoryDiscountType | null {
  if (value === undefined || value === null || value === "") {
    return options.allowNullLegacy === true ? null : "fixed";
  }
  const raw = String(value).trim().toLowerCase();
  if (raw === "fixed" || raw === "percentage") return raw;
  throw new AppError(
    "ERR_INVENTORY_DISCOUNT_TYPE_INVALID",
    400,
    "Tipo de desconto inválido."
  );
}

export function resolveItemDiscountType(
  discountType: unknown
): InventoryDiscountType {
  // Legado / null → fixed (semântica histórica de discountAmount).
  return normalizeDiscountType(discountType, { allowNullLegacy: true }) || "fixed";
}

export function parseDiscountPercent(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    throw new AppError(
      "ERR_INVENTORY_DISCOUNT_PERCENT_REQUIRED",
      400,
      "Informe o percentual de desconto."
    );
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError(
      "ERR_INVENTORY_DISCOUNT_PERCENT_INVALID",
      400,
      "Percentual de desconto inválido."
    );
  }
  if (n < 0 || n > 100) {
    throw new AppError(
      "ERR_INVENTORY_DISCOUNT_PERCENT_RANGE",
      400,
      "Percentual de desconto deve estar entre 0 e 100."
    );
  }
  return roundMoney(n);
}

export function computeLineGross(unitPrice: number, quantity: number): number {
  return roundMoney(toMoney(unitPrice) * Number(quantity));
}

/**
 * Desconto monetário da LINHA.
 * fixed: usa amount informado (histórico).
 * percentage: percent × bruto da linha.
 */
export function computeItemDiscountAmount(input: {
  discountType?: unknown;
  discountAmount?: unknown;
  discountPercent?: unknown;
  unitPrice: number;
  quantity: number;
}): { discountType: InventoryDiscountType; discountPercent: number | null; discountAmount: number; lineGross: number; lineTotal: number } {
  const lineGross = computeLineGross(input.unitPrice, input.quantity);
  const discountType = resolveItemDiscountType(input.discountType);

  let discountPercent: number | null = null;
  let discountAmount = 0;

  if (discountType === "percentage") {
    discountPercent = parseDiscountPercent(input.discountPercent);
    discountAmount = roundMoney((lineGross * discountPercent) / 100);
  } else {
    discountAmount =
      input.discountAmount === undefined || input.discountAmount === null
        ? 0
        : roundMoney(toMoney(input.discountAmount as string | number));
    if (discountAmount < 0) {
      throw new AppError(
        "ERR_INVENTORY_DISCOUNT_AMOUNT_INVALID",
        400,
        "Desconto inválido."
      );
    }
  }

  if (discountAmount > lineGross + 1e-9) {
    throw new AppError(
      "ERR_INVENTORY_DISCOUNT_EXCEEDS_LINE",
      400,
      "Desconto não pode ser maior que o valor da linha."
    );
  }

  const lineTotal = roundMoney(lineGross - discountAmount);
  if (lineTotal < -1e-9) {
    throw new AppError(
      "ERR_INVENTORY_LINE_TOTAL_NEGATIVE",
      400,
      "Total da linha não pode ser negativo."
    );
  }

  return {
    discountType,
    discountPercent,
    discountAmount: roundMoney(Math.max(0, discountAmount)),
    lineGross,
    lineTotal: roundMoney(Math.max(0, lineTotal))
  };
}

export function computeGlobalDiscountAmount(input: {
  globalDiscountType?: unknown;
  globalDiscountAmount?: unknown;
  globalDiscountPercent?: unknown;
  merchandiseAfterItemDiscounts: number;
}): {
  globalDiscountType: InventoryDiscountType | null;
  globalDiscountPercent: number | null;
  globalDiscountAmount: number;
  netMerchandise: number;
} {
  const base = roundMoney(Math.max(0, toMoney(input.merchandiseAfterItemDiscounts)));
  const rawType = normalizeDiscountType(input.globalDiscountType, {
    allowNullLegacy: true
  });

  if (rawType == null) {
    return {
      globalDiscountType: null,
      globalDiscountPercent: null,
      globalDiscountAmount: 0,
      netMerchandise: base
    };
  }

  let globalDiscountPercent: number | null = null;
  let globalDiscountAmount = 0;

  if (rawType === "percentage") {
    globalDiscountPercent = parseDiscountPercent(input.globalDiscountPercent);
    globalDiscountAmount = roundMoney((base * globalDiscountPercent) / 100);
  } else {
    globalDiscountAmount =
      input.globalDiscountAmount === undefined ||
      input.globalDiscountAmount === null
        ? 0
        : roundMoney(toMoney(input.globalDiscountAmount as string | number));
    if (globalDiscountAmount < 0) {
      throw new AppError(
        "ERR_INVENTORY_GLOBAL_DISCOUNT_INVALID",
        400,
        "Desconto da venda inválido."
      );
    }
  }

  if (globalDiscountAmount > base + 1e-9) {
    throw new AppError(
      "ERR_INVENTORY_GLOBAL_DISCOUNT_EXCEEDS_BASE",
      400,
      "Desconto da venda não pode ser maior que a mercadoria após descontos dos itens."
    );
  }

  const netMerchandise = roundMoney(base - globalDiscountAmount);
  if (netMerchandise < -1e-9) {
    throw new AppError(
      "ERR_INVENTORY_NET_MERCHANDISE_NEGATIVE",
      400,
      "Mercadoria líquida não pode ser negativa."
    );
  }

  return {
    globalDiscountType: rawType,
    globalDiscountPercent,
    globalDiscountAmount: roundMoney(Math.max(0, globalDiscountAmount)),
    netMerchandise: roundMoney(Math.max(0, netMerchandise))
  };
}

export function effectivePercent(amount: number, base: number): number {
  const b = toMoney(base);
  if (b <= 0) return 0;
  return roundMoney((toMoney(amount) / b) * 100);
}

/**
 * Percentual efetivo sobre o bruto da mercadoria (governança global).
 * totalDiscount = itemDiscountTotal + globalDiscountAmount
 */
export function merchandiseEffectiveDiscountPercent(input: {
  grossMerchandise: number;
  itemDiscountTotal: number;
  globalDiscountAmount: number;
}): number {
  const gross = toMoney(input.grossMerchandise);
  if (gross <= 0) return 0;
  const totalDisc = roundMoney(
    toMoney(input.itemDiscountTotal) + toMoney(input.globalDiscountAmount)
  );
  return roundMoney((totalDisc / gross) * 100);
}
