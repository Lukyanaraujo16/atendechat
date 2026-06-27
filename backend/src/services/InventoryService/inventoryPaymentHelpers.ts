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
  if (input.saleStatus === "draft") {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_DRAFT",
      400,
      "Não é possível alterar pagamento de venda em rascunho."
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
