import AppError from "../../errors/AppError";
import { InventorySaleStatus } from "../../models/InventorySale";
import { parseOptionalDateQuery } from "./inventoryTenant";
import { roundMoney } from "./inventorySaleHelpers";

export const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "partial",
  "refunded"
] as const;

export const PAYMENT_METHODS = [
  "cash",
  "pix",
  "credit_card",
  "debit_card",
  "bank_transfer",
  "boleto",
  "other"
] as const;

export type InventoryPaymentStatus = (typeof PAYMENT_STATUSES)[number];
export type InventoryPaymentMethod = (typeof PAYMENT_METHODS)[number];

const PAYMENT_STATUS_SET = new Set<string>(PAYMENT_STATUSES);
const PAYMENT_METHOD_SET = new Set<string>(PAYMENT_METHODS);

export function isInventoryPaymentStatus(value: string): value is InventoryPaymentStatus {
  return PAYMENT_STATUS_SET.has(value);
}

export function isInventoryPaymentMethod(value: string): value is InventoryPaymentMethod {
  return PAYMENT_METHOD_SET.has(value);
}

export function parsePaymentStatus(value: unknown): InventoryPaymentStatus {
  const status = String(value ?? "").trim();
  if (!isInventoryPaymentStatus(status)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "paymentStatus inválido.");
  }
  return status;
}

export function parseOptionalPaymentMethod(
  value: unknown
): InventoryPaymentMethod | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const method = String(value).trim();
  if (!isInventoryPaymentMethod(method)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "paymentMethod inválido.");
  }
  return method;
}

export function parsePaidAmount(value: unknown): number {
  const n = Number(value);
  const amount = Number.isFinite(n) ? n : 0;
  if (amount < 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "paidAmount não pode ser negativo."
    );
  }
  return roundMoney(amount);
}

export function parseOptionalPaidAt(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  return parseOptionalDateQuery(value) ?? null;
}

export function derivePaymentStatusFromAmount(
  paidAmount: number,
  totalAmount: number
): InventoryPaymentStatus {
  const paid = roundMoney(paidAmount);
  const total = roundMoney(totalAmount);

  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "partial";
}

export function validatePaymentConsistency(input: {
  saleStatus: InventorySaleStatus;
  totalAmount: number;
  paymentStatus: InventoryPaymentStatus;
  paidAmount: number;
}): void {
  const total = roundMoney(input.totalAmount);
  const paid = roundMoney(input.paidAmount);

  if (paid > total) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "paidAmount não pode ser maior que o total da venda."
    );
  }

  if (input.paymentStatus === "paid" && paid !== total) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Para status pago, paidAmount deve ser igual ao total."
    );
  }

  if (input.paymentStatus === "partial" && (paid <= 0 || paid >= total)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Para status parcial, paidAmount deve ser maior que zero e menor que o total."
    );
  }

  if (input.paymentStatus === "unpaid" && paid !== 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Para status não pago, paidAmount deve ser zero."
    );
  }

  if (
    input.paymentStatus === "refunded" &&
    input.saleStatus !== "cancelled" &&
    input.saleStatus !== "completed"
  ) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Reembolso só é permitido para vendas concluídas ou canceladas."
    );
  }
}

export function assertSaleAllowsPaymentUpdate(input: {
  saleStatus: InventorySaleStatus;
  paymentStatus: InventoryPaymentStatus;
}): void {
  if (input.saleStatus === "draft" && input.paymentStatus !== "unpaid") {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_DRAFT_STATUS",
      400,
      "Venda em rascunho só aceita pagamento com status não pago (unpaid)."
    );
  }

  if (
    input.saleStatus === "cancelled" &&
    input.paymentStatus !== "refunded"
  ) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_CANCELLED",
      400,
      "Venda cancelada só permite status de pagamento reembolsado."
    );
  }
}

export function resolvePaidAtForPaymentUpdate(input: {
  paymentStatus: InventoryPaymentStatus;
  paidAt?: unknown;
  existingPaidAt: Date | null;
}): Date | null {
  if (input.paymentStatus === "unpaid" || input.paymentStatus === "refunded") {
    return null;
  }

  if (input.paidAt !== undefined) {
    return parseOptionalPaidAt(input.paidAt);
  }

  if (input.existingPaidAt) {
    return input.existingPaidAt;
  }

  return new Date();
}

const MIN_CARD_INSTALLMENTS = 1;
const MAX_CARD_INSTALLMENTS = 18;

function invalidCardInstallmentCount(): AppError {
  return new AppError(
    "ERR_VALIDATION_ERROR",
    400,
    "Parcelas do cartão devem ser um inteiro de 1 a 18."
  );
}

export function parseCardInstallmentCount(value: unknown): number {
  if (typeof value === "boolean" || value == null || typeof value === "object") {
    throw invalidCardInstallmentCount();
  }
  if (typeof value === "number") {
    if (
      !Number.isInteger(value) ||
      value < MIN_CARD_INSTALLMENTS ||
      value > MAX_CARD_INSTALLMENTS
    ) {
      throw invalidCardInstallmentCount();
    }
    return value;
  }
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw invalidCardInstallmentCount();
  }
  const count = Number(raw);
  if (count < MIN_CARD_INSTALLMENTS || count > MAX_CARD_INSTALLMENTS) {
    throw invalidCardInstallmentCount();
  }
  return count;
}

function storedCardInstallmentCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

/**
 * Cartão novo exige 1–18. Qualquer outra forma zera as parcelas.
 * NULL histórico só permanece quando a venda já era cartão e esta gravação omite o campo.
 */
export function resolveCardInstallmentCount(input: {
  paymentMethod: InventoryPaymentMethod | null;
  raw: unknown;
  rawProvided: boolean;
  existing: number | null;
  preserveHistoricalNull?: boolean;
}): number | null {
  if (input.paymentMethod !== "credit_card") {
    return null;
  }
  if (input.rawProvided) {
    return parseCardInstallmentCount(input.raw);
  }
  const existing = storedCardInstallmentCount(input.existing);
  if (
    existing != null &&
    existing >= MIN_CARD_INSTALLMENTS &&
    existing <= MAX_CARD_INSTALLMENTS
  ) {
    return existing;
  }
  if (input.preserveHistoricalNull && input.existing == null) {
    return null;
  }
  throw new AppError(
    "ERR_VALIDATION_ERROR",
    400,
    "Informe as parcelas do cartão, de 1 a 18."
  );
}

export function assertStoredCardInstallments(
  paymentMethod: InventoryPaymentMethod | null,
  cardInstallmentCount: number | null
): number | null {
  if (paymentMethod !== "credit_card") return null;
  return parseCardInstallmentCount(cardInstallmentCount);
}

/** Conclusão: só cartão com parcelas já gravadas nasce pago pelo total. */
export function settlePaymentOnComplete(input: {
  paymentMethod: InventoryPaymentMethod | null;
  cardInstallmentCount: number | null;
  totalAmount: number;
  paidAmount: number;
  existingPaidAt: Date | null;
}): {
  paymentStatus: InventoryPaymentStatus;
  paidAmount: number;
  paidAt: Date | null;
} {
  if (input.paymentMethod === "credit_card") {
    assertStoredCardInstallments(
      input.paymentMethod,
      input.cardInstallmentCount
    );
    const paymentStatus: InventoryPaymentStatus = "paid";
    return {
      paymentStatus,
      paidAmount: input.totalAmount,
      paidAt: resolvePaidAtForPaymentUpdate({
        paymentStatus,
        existingPaidAt: input.existingPaidAt
      })
    };
  }

  const paymentStatus = derivePaymentStatusFromAmount(
    input.paidAmount,
    input.totalAmount
  );
  return {
    paymentStatus,
    paidAmount: input.paidAmount,
    paidAt: resolvePaidAtForPaymentUpdate({
      paymentStatus,
      existingPaidAt: input.existingPaidAt
    })
  };
}
