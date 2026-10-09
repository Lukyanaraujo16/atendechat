import AppError from "../../errors/AppError";
import InventoryReceivableInstallment, {
  InventoryReceivableInstallmentStatus
} from "../../models/InventoryReceivableInstallment";
import { InventoryReceivableStatus } from "../../models/InventoryReceivable";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export function todayCivilDate(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(now);
}

export function deriveInstallmentDisplayStatus(
  status: InventoryReceivableInstallmentStatus | string,
  dueDate: string,
  today: string = todayCivilDate()
): string {
  if (status === "cancelled" || status === "paid") return status;
  if (
    (status === "open" || status === "partial") &&
    String(dueDate) < today
  ) {
    return "overdue";
  }
  return status;
}

export function installmentStatusFromAmounts(
  originalAmount: number,
  paidAmount: number,
  openAmount: number
): InventoryReceivableInstallmentStatus {
  const original = roundMoney(originalAmount);
  const paid = roundMoney(paidAmount);
  const open = roundMoney(openAmount);
  if (open <= 0 && paid >= original) return "paid";
  if (paid > 0 && open > 0) return "partial";
  if (open > 0 && paid <= 0) return "open";
  if (open <= 0) return "paid";
  return "open";
}

export function receivableStatusFromInstallments(
  installments: Array<{ status: string; openAmount: string | number }>
): InventoryReceivableStatus {
  const active = installments.filter(i => i.status !== "cancelled");
  if (active.length === 0) return "cancelled";
  const allPaid = active.every(i => i.status === "paid");
  if (allPaid) return "paid";
  const anyPaid = active.some(
    i => i.status === "paid" || i.status === "partial" || toMoney(i.openAmount) < toMoney(
      // open vs original approximated via partial/paid
      i.status === "partial" ? 1 : 0
    ) || i.status === "partial"
  );
  const openSum = roundMoney(
    active.reduce((acc, i) => acc + toMoney(i.openAmount), 0)
  );
  const anyPartialOrPaid = active.some(
    i => i.status === "partial" || i.status === "paid"
  );
  if (openSum <= 0) return "paid";
  if (anyPartialOrPaid || anyPaid) return "partial";
  return "open";
}

/**
 * Ordena parcelas para alocação automática:
 * vencidos mais antigos → vencimentos mais próximos → demais.
 */
export function sortInstallmentsForAllocation<
  T extends { dueDate: string; status: string; openAmount: string | number }
>(installments: T[], today: string = todayCivilDate()): T[] {
  const open = installments.filter(
    i =>
      (i.status === "open" || i.status === "partial") &&
      roundMoney(toMoney(i.openAmount)) > 0
  );

  return [...open].sort((a, b) => {
    const aOverdue = String(a.dueDate) < today;
    const bOverdue = String(b.dueDate) < today;
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (a.dueDate < b.dueDate) return -1;
    if (a.dueDate > b.dueDate) return 1;
    return 0;
  });
}

export function allocateAmountAcrossInstallments(
  installments: Array<{
    id: number;
    dueDate: string;
    status: string;
    openAmount: string | number;
  }>,
  amount: number,
  today: string = todayCivilDate()
): Array<{ installmentId: number; amount: number }> {
  const total = roundMoney(amount);
  if (total <= 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Valor do recebimento deve ser maior que zero."
    );
  }

  const ordered = sortInstallmentsForAllocation(installments, today);
  const openTotal = roundMoney(
    ordered.reduce((acc, i) => acc + toMoney(i.openAmount), 0)
  );
  if (total > openTotal) {
    throw new AppError(
      "ERR_INVENTORY_RECEIVABLE_OVERPAYMENT",
      400,
      "Valor excede o saldo em aberto das parcelas selecionadas."
    );
  }

  let remaining = total;
  const allocations: Array<{ installmentId: number; amount: number }> = [];
  for (const row of ordered) {
    if (remaining <= 0) break;
    const open = roundMoney(toMoney(row.openAmount));
    const take = roundMoney(Math.min(open, remaining));
    if (take > 0) {
      allocations.push({ installmentId: row.id, amount: take });
      remaining = roundMoney(remaining - take);
    }
  }
  return allocations;
}

export function assertPositiveReceivableAmount(value: unknown): number {
  const n = roundMoney(Number(value));
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Valor do recebimento deve ser maior que zero."
    );
  }
  return n;
}

export type InstallmentListItem = {
  installmentId: number;
  receivableId: number;
  companyId: number;
  customerId: number;
  customerName: string | null;
  customerDocument: string | null;
  saleId: number | null;
  saleNumber: number | null;
  sequence: number;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  openAmount: number;
  status: string;
  displayStatus: string;
  originType: string;
};

export function mapInstallmentRow(
  inst: InventoryReceivableInstallment,
  extras: {
    customerId: number;
    customerName: string | null;
    customerDocument: string | null;
    saleId: number | null;
    saleNumber: number | null;
    originType: string;
  },
  today: string = todayCivilDate()
): InstallmentListItem {
  const status = inst.status;
  return {
    installmentId: inst.id,
    receivableId: inst.receivableId,
    companyId: inst.companyId,
    customerId: extras.customerId,
    customerName: extras.customerName,
    customerDocument: extras.customerDocument,
    saleId: extras.saleId,
    saleNumber: extras.saleNumber,
    sequence: inst.sequence,
    dueDate: String(inst.dueDate),
    originalAmount: roundMoney(toMoney(inst.originalAmount)),
    paidAmount: roundMoney(toMoney(inst.paidAmount)),
    openAmount: roundMoney(toMoney(inst.openAmount)),
    status,
    displayStatus: deriveInstallmentDisplayStatus(
      status,
      String(inst.dueDate),
      today
    ),
    originType: extras.originType
  };
}
