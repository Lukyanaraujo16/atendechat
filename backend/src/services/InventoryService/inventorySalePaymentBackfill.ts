import {
  InventoryPaymentMethod,
  InventoryPaymentStatus
} from "../../models/InventorySale";
import { InventorySalePaymentLineStatus } from "../../models/InventorySalePayment";
import { PAYMENT_METHODS } from "./inventoryPaymentHelpers";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export type LegacySaleForPaymentBackfill = {
  id: number;
  companyId: number;
  paymentStatus: InventoryPaymentStatus | string | null;
  paymentMethod: InventoryPaymentMethod | string | null;
  paidAmount: string | number | null;
  totalAmount: string | number | null;
  paidAt: Date | string | null;
  paymentNotes: string | null;
  cardInstallmentCount: number | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export type PlannedInventorySalePayment = {
  companyId: number;
  saleId: number;
  method: InventoryPaymentMethod;
  amount: number;
  status: InventorySalePaymentLineStatus;
  paidAt: Date | string | null;
  notes: string | null;
  cardInstallmentCount: number | null;
  createdByUserId: null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export type BackfillPlanResult =
  | { action: "create"; payment: PlannedInventorySalePayment }
  | { action: "skip"; reason: string };

function isKnownMethod(raw: unknown): raw is InventoryPaymentMethod {
  return (
    typeof raw === "string" &&
    (PAYMENT_METHODS as readonly string[]).includes(raw)
  );
}

function normalizeInstallments(
  method: InventoryPaymentMethod,
  raw: number | null | undefined
): number | null {
  if (method !== "credit_card") return null;
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 18) return null;
  return n;
}

function pickTimestamp(
  preferred: Date | string | null | undefined,
  fallbackA: Date | string | null | undefined,
  fallbackB: Date | string | null | undefined
): Date | string {
  if (preferred != null && preferred !== "") return preferred;
  if (fallbackA != null && fallbackA !== "") return fallbackA;
  if (fallbackB != null && fallbackB !== "") return fallbackB;
  return new Date(0).toISOString();
}

/**
 * Planeja no máximo UMA linha de payment a partir do estado legado da sale.
 * Conservador: não inventa dinheiro, método, parcelas ou usuário.
 */
export function planInventorySalePaymentBackfill(
  sale: LegacySaleForPaymentBackfill
): BackfillPlanResult {
  const status = String(sale.paymentStatus || "unpaid");
  const methodRaw = sale.paymentMethod;
  const paid = roundMoney(toMoney(sale.paidAmount));
  const total = roundMoney(toMoney(sale.totalAmount));

  if (status === "refunded") {
    return { action: "skip", reason: "refunded_no_reliable_history" };
  }

  if (!isKnownMethod(methodRaw)) {
    if (paid > 0) {
      return { action: "skip", reason: "method_null_with_paid_amount" };
    }
    return { action: "skip", reason: "unpaid_without_method" };
  }

  const method = methodRaw;
  const installments = normalizeInstallments(method, sale.cardInstallmentCount);
  const notes = sale.paymentNotes != null ? String(sale.paymentNotes) : null;

  if (status === "paid") {
    if (paid <= 0) {
      return { action: "skip", reason: "paid_with_zero_amount" };
    }
    if (paid !== total) {
      return { action: "skip", reason: "paid_amount_mismatch_total" };
    }
    const ts = pickTimestamp(sale.paidAt, sale.updatedAt, sale.createdAt);
    return {
      action: "create",
      payment: {
        companyId: sale.companyId,
        saleId: sale.id,
        method,
        amount: paid,
        status: "paid",
        paidAt: sale.paidAt ?? null,
        notes,
        cardInstallmentCount: installments,
        createdByUserId: null,
        createdAt: ts,
        updatedAt: ts
      }
    };
  }

  if (status === "partial") {
    if (paid <= 0) {
      return { action: "skip", reason: "partial_with_zero_amount" };
    }
    if (paid >= total) {
      return { action: "skip", reason: "partial_amount_not_strictly_less" };
    }
    const ts = pickTimestamp(sale.paidAt, sale.updatedAt, sale.createdAt);
    return {
      action: "create",
      payment: {
        companyId: sale.companyId,
        saleId: sale.id,
        method,
        amount: paid,
        status: "paid",
        paidAt: sale.paidAt ?? null,
        notes,
        cardInstallmentCount: installments,
        createdByUserId: null,
        createdAt: ts,
        updatedAt: ts
      }
    };
  }

  if (status === "unpaid") {
    if (paid > 0) {
      return { action: "skip", reason: "unpaid_with_positive_paid_amount" };
    }
    if (total <= 0) {
      return { action: "skip", reason: "unpaid_with_non_positive_total" };
    }
    const ts = pickTimestamp(sale.updatedAt, sale.createdAt, null);
    return {
      action: "create",
      payment: {
        companyId: sale.companyId,
        saleId: sale.id,
        method,
        amount: total,
        status: "pending",
        paidAt: null,
        notes,
        cardInstallmentCount: installments,
        createdByUserId: null,
        createdAt: ts,
        updatedAt: ts
      }
    };
  }

  return { action: "skip", reason: `unknown_payment_status_${status}` };
}
