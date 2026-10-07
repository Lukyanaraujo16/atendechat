import AppError from "../../errors/AppError";
import InventoryDeliveryMethod, {
  InventoryDeliveryMethodKind
} from "../../models/InventoryDeliveryMethod";
import { normalizeOptionalString } from "./inventoryTenant";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export const INVENTORY_DELIVERY_KINDS: InventoryDeliveryMethodKind[] = [
  "pickup",
  "courier",
  "carrier",
  "other"
];

export const DEFAULT_PICKUP_METHOD_NAME = "Retirada na loja";

/** UFs brasileiras (sigla 2 letras). */
export const BRAZIL_UF_SET = new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO"
]);

export type SaleDeliveryAddressInput = {
  recipientName?: unknown;
  recipientPhone?: unknown;
  postalCode?: unknown;
  street?: unknown;
  number?: unknown;
  complement?: unknown;
  district?: unknown;
  city?: unknown;
  state?: unknown;
  notes?: unknown;
};

export type NormalizedSaleDeliveryAddress = {
  recipientName: string | null;
  recipientPhone: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

export function parseDeliveryKind(raw: unknown): InventoryDeliveryMethodKind {
  const kind = String(raw ?? "").trim().toLowerCase();
  if (!INVENTORY_DELIVERY_KINDS.includes(kind as InventoryDeliveryMethodKind)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "kind de modalidade inválido. Use: pickup, courier, carrier, other."
    );
  }
  return kind as InventoryDeliveryMethodKind;
}

export function defaultRequiresAddressForKind(
  kind: InventoryDeliveryMethodKind
): boolean {
  return kind !== "pickup";
}

export function defaultAllowAmountOverrideForKind(
  kind: InventoryDeliveryMethodKind
): boolean {
  return kind !== "pickup";
}

/**
 * freightAmount monetário:
 * - >= 0
 * - rejeita NaN/infinito/texto inválido
 * - arredonda com roundMoney
 */
export function parseNonNegativeMoney(
  raw: unknown,
  fieldLabel = "freightAmount"
): number {
  if (raw === undefined || raw === null || raw === "") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${fieldLabel} é obrigatório.`
    );
  }
  if (typeof raw === "string" && raw.trim() === "") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${fieldLabel} inválido.`
    );
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${fieldLabel} inválido.`
    );
  }
  if (n < 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${fieldLabel} não pode ser negativo.`
    );
  }
  return roundMoney(n);
}

export function parseOptionalNonNegativeMoney(
  raw: unknown,
  fieldLabel = "freightAmount"
): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  return parseNonNegativeMoney(raw, fieldLabel);
}

/**
 * Resolve freight autoritativo:
 * - pickup → sempre 0
 * - allowAmountOverride=false → defaultAmount (payload ignorado)
 * - allowAmountOverride=true → payload se informado, senão defaultAmount
 */
export function resolveFreightAmount(input: {
  method: Pick<
    InventoryDeliveryMethod,
    "kind" | "defaultAmount" | "allowAmountOverride"
  >;
  requestedFreightAmount?: unknown;
}): number {
  if (input.method.kind === "pickup") {
    return 0;
  }

  const defaultAmount = parseNonNegativeMoney(
    input.method.defaultAmount,
    "defaultAmount"
  );

  if (!input.method.allowAmountOverride) {
    return defaultAmount;
  }

  const requested = parseOptionalNonNegativeMoney(
    input.requestedFreightAmount,
    "freightAmount"
  );
  return requested != null ? requested : defaultAmount;
}

export function assertPickupInvariants(input: {
  kind: InventoryDeliveryMethodKind;
  defaultAmount: number;
  allowAmountOverride: boolean;
  requiresAddress: boolean;
}): void {
  if (input.kind !== "pickup") return;
  if (input.defaultAmount !== 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Modalidade pickup deve ter defaultAmount = 0."
    );
  }
  if (input.allowAmountOverride) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Modalidade pickup não permite alteração de valor."
    );
  }
  if (input.requiresAddress) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Modalidade pickup não exige endereço."
    );
  }
}

export function normalizeOptionalState(raw: unknown): string | null {
  const trimmed = normalizeOptionalString(raw, 2);
  if (!trimmed) return null;
  const uf = trimmed.toUpperCase();
  if (!BRAZIL_UF_SET.has(uf)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "UF inválida. Use sigla brasileira de 2 letras."
    );
  }
  return uf;
}

export function normalizeSaleDeliveryAddress(
  raw: SaleDeliveryAddressInput | null | undefined
): NormalizedSaleDeliveryAddress {
  const src = raw || {};
  return {
    recipientName: normalizeOptionalString(src.recipientName, 120),
    recipientPhone: normalizeOptionalString(src.recipientPhone, 50),
    postalCode: normalizeOptionalString(src.postalCode, 20),
    street: normalizeOptionalString(src.street, 255),
    number: normalizeOptionalString(src.number, 30),
    complement: normalizeOptionalString(src.complement, 120),
    district: normalizeOptionalString(src.district, 120),
    city: normalizeOptionalString(src.city, 120),
    state: normalizeOptionalState(src.state),
    notes: normalizeOptionalString(src.notes, 2000)
  };
}

export function assertAddressRequiredWhenNeeded(
  requiresAddress: boolean,
  address: NormalizedSaleDeliveryAddress
): void {
  if (!requiresAddress) return;

  const missing: string[] = [];
  if (!address.recipientName) missing.push("recipientName");
  if (!address.recipientPhone) missing.push("recipientPhone");
  if (!address.street) missing.push("street");
  if (!address.number) missing.push("number");
  if (!address.district) missing.push("district");
  if (!address.city) missing.push("city");
  if (!address.state) missing.push("state");

  if (missing.length) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `Endereço de entrega incompleto. Obrigatórios: ${missing.join(", ")}.`
    );
  }
}

export function merchandiseTotalAfterDiscounts(input: {
  totalAmount: string | number;
  freightAmount: string | number;
}): number {
  return roundMoney(toMoney(input.totalAmount) - toMoney(input.freightAmount));
}

export function computeCommissionExcludingFreight(input: {
  totalAmount: string | number;
  freightAmount: string | number;
  commissionRate: number;
}): number {
  const base = merchandiseTotalAfterDiscounts(input);
  return roundMoney((base * input.commissionRate) / 100);
}
