import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventorySale, {
  InventoryPaymentMethod,
  InventoryPaymentStatus
} from "../../models/InventorySale";
import InventorySalePayment from "../../models/InventorySalePayment";
import { calculateSalePaymentAggregate } from "./inventorySalePaymentAggregate";
import { planInventorySalePaymentBackfill } from "./inventorySalePaymentBackfill";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export type LegacyPaymentApplyInput = {
  /** Valor absoluto pago desejado (contrato legado). */
  targetPaidAmount: number;
  paymentStatus: InventoryPaymentStatus;
  paymentMethod: InventoryPaymentMethod | null;
  cardInstallmentCount: number | null;
  paymentNotes: string | null;
  paidAt: Date | null;
  actorUserId?: number | null;
};

function moneyOf(row: { amount: string | number }): number {
  return roundMoney(toMoney(row.amount));
}

export async function listSalePayments(
  companyId: number,
  saleId: number,
  transaction: Transaction
): Promise<InventorySalePayment[]> {
  return InventorySalePayment.findAll({
    where: { companyId, saleId },
    order: [["id", "ASC"]],
    transaction
  });
}

/**
 * Materializa lines a partir do estado legado quando a sale ainda não tem payments
 * (pós-P1 / pré-P2). Reutiliza o planner conservador da P1.
 */
export async function bootstrapLegacyPaymentsIfNeeded(
  sale: InventorySale,
  transaction: Transaction,
  actorUserId: number | null = null
): Promise<InventorySalePayment[]> {
  const existing = await listSalePayments(sale.companyId, sale.id, transaction);
  if (existing.length > 0) {
    return existing;
  }

  if (String(sale.paymentStatus) === "refunded") {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_REFUNDED_UNSUPPORTED",
      400,
      "Venda reembolsada sem histórico de linhas não pode ser reconciliada automaticamente."
    );
  }

  const plan = planInventorySalePaymentBackfill({
    id: sale.id,
    companyId: sale.companyId,
    paymentStatus: sale.paymentStatus,
    paymentMethod: sale.paymentMethod,
    paidAmount: sale.paidAmount,
    totalAmount: sale.totalAmount,
    paidAt: sale.paidAt,
    paymentNotes: sale.paymentNotes,
    cardInstallmentCount: sale.cardInstallmentCount,
    createdAt: sale.createdAt,
    updatedAt: sale.updatedAt
  });

  if (plan.action === "skip") {
    return [];
  }

  const p = plan.payment;
  await InventorySalePayment.create(
    {
      companyId: p.companyId,
      saleId: p.saleId,
      method: p.method,
      amount: p.amount,
      status: p.status,
      paidAt: p.paidAt,
      notes: p.notes,
      cardInstallmentCount: p.cardInstallmentCount,
      createdByUserId: actorUserId,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    },
    { transaction }
  );

  return listSalePayments(sale.companyId, sale.id, transaction);
}

async function destroyPendingLines(
  lines: InventorySalePayment[],
  transaction: Transaction
): Promise<void> {
  for (const row of lines.filter(l => l.status === "pending")) {
    await row.destroy({ transaction });
  }
}

async function upsertSinglePending(input: {
  companyId: number;
  saleId: number;
  method: InventoryPaymentMethod;
  amount: number;
  notes: string | null;
  cardInstallmentCount: number | null;
  actorUserId: number | null;
  existingPending: InventorySalePayment[];
  transaction: Transaction;
}): Promise<void> {
  const amount = roundMoney(input.amount);
  if (amount <= 0) {
    await destroyPendingLines(input.existingPending, input.transaction);
    return;
  }

  const [primary, ...extras] = input.existingPending;
  for (const extra of extras) {
    await extra.destroy({ transaction: input.transaction });
  }

  if (primary) {
    await primary.update(
      {
        method: input.method,
        amount,
        status: "pending",
        paidAt: null,
        notes: input.notes,
        cardInstallmentCount:
          input.method === "credit_card" ? input.cardInstallmentCount : null
      },
      { transaction: input.transaction }
    );
    return;
  }

  await InventorySalePayment.create(
    {
      companyId: input.companyId,
      saleId: input.saleId,
      method: input.method,
      amount,
      status: "pending",
      paidAt: null,
      notes: input.notes,
      cardInstallmentCount:
        input.method === "credit_card" ? input.cardInstallmentCount : null,
      createdByUserId: input.actorUserId
    },
    { transaction: input.transaction }
  );
}

function assertNoPaidMethodReclassification(
  paidLines: InventorySalePayment[],
  nextMethod: InventoryPaymentMethod | null
): void {
  if (paidLines.length === 0) return;
  if (nextMethod == null) return;

  const methods = new Set(paidLines.map(l => l.method));
  if (methods.size !== 1 || !methods.has(nextMethod)) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_METHOD_LOCKED",
      400,
      "Não é possível alterar o método de um valor já recebido. Correção financeira explícita será oferecida em fase futura."
    );
  }
}

function assertNoPaidCardInstallmentChange(
  paidLines: InventorySalePayment[],
  nextMethod: InventoryPaymentMethod | null,
  nextInstallments: number | null
): void {
  if (nextMethod !== "credit_card") return;
  for (const row of paidLines) {
    if (row.method !== "credit_card") continue;
    const current =
      row.cardInstallmentCount == null ? null : Number(row.cardInstallmentCount);
    if (current !== nextInstallments) {
      throw new AppError(
        "ERR_INVENTORY_SALE_PAYMENT_INSTALLMENTS_LOCKED",
        400,
        "Não é possível alterar as parcelas de um pagamento em cartão já recebido."
      );
    }
  }
}

function resolveSalePaidAtCache(input: {
  paymentStatus: InventoryPaymentStatus;
  paidAt: Date | null;
  paidLines: InventorySalePayment[];
}): Date | null {
  if (input.paymentStatus === "unpaid" || input.paymentStatus === "refunded") {
    return null;
  }
  if (input.paidAt) return input.paidAt;
  const lastPaid = [...input.paidLines]
    .filter(l => l.status === "paid" && l.paidAt)
    .pop();
  return lastPaid?.paidAt ?? new Date();
}

export type PaymentCachePatch = {
  paymentStatus: InventoryPaymentStatus;
  paidAmount: number;
  paidAt: Date | null;
  paymentMethod: InventoryPaymentMethod | null;
  cardInstallmentCount: number | null;
  paymentNotes: string | null;
};

/**
 * Reconcilia o contrato legado absoluto (paidAmount total) com lines 1:N.
 * Premissa P2: pending existentes vêm só de backfill P1 ou fluxo legado P2.
 */
export async function applyLegacyAbsolutePayment(
  sale: InventorySale,
  input: LegacyPaymentApplyInput,
  transaction: Transaction
): Promise<PaymentCachePatch> {
  if (sale.status === "cancelled") {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_CANCELLED",
      400,
      "Não é possível atualizar pagamento de venda cancelada."
    );
  }

  if (input.paymentStatus === "refunded") {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_REFUNDED_UNSUPPORTED",
      400,
      "Reembolso operacional ainda não é suportado neste fluxo."
    );
  }

  const actorUserId = input.actorUserId ?? null;
  const total = roundMoney(toMoney(sale.totalAmount));
  const target = roundMoney(input.targetPaidAmount);

  if (target > total) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_OVERPAYMENT",
      400,
      "paidAmount não pode ser maior que o total da venda."
    );
  }

  let lines = await bootstrapLegacyPaymentsIfNeeded(
    sale,
    transaction,
    actorUserId
  );

  const activeMethods = new Set(
    lines.filter(l => l.status !== "reversed").map(l => l.method)
  );
  if (activeMethods.size > 1) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_USE_LINES_API",
      400,
      "Esta venda possui múltiplas formas de pagamento. Use a gestão de pagamentos do PDV."
    );
  }

  const paidLines = lines.filter(l => l.status === "paid");
  const currentPaid = calculateSalePaymentAggregate(total, lines).effectivePaid;

  if (target < currentPaid) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_REDUCTION_FORBIDDEN",
      400,
      "Não é possível reduzir o valor já recebido sem operação de estorno."
    );
  }

  const nextMethod =
    input.paymentMethod !== undefined
      ? input.paymentMethod
      : sale.paymentMethod;

  if (currentPaid > 0) {
    assertNoPaidMethodReclassification(paidLines, nextMethod);
    assertNoPaidCardInstallmentChange(
      paidLines,
      nextMethod,
      input.cardInstallmentCount
    );
  }

  const delta = roundMoney(target - currentPaid);
  if (delta > 0) {
    if (!nextMethod) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "paymentMethod é obrigatório para registrar valor recebido."
      );
    }
    await InventorySalePayment.create(
      {
        companyId: sale.companyId,
        saleId: sale.id,
        method: nextMethod,
        amount: delta,
        status: "paid",
        paidAt: input.paidAt ?? new Date(),
        notes: input.paymentNotes,
        cardInstallmentCount:
          nextMethod === "credit_card" ? input.cardInstallmentCount : null,
        createdByUserId: actorUserId
      },
      { transaction }
    );
  }

  lines = await listSalePayments(sale.companyId, sale.id, transaction);
  const pendingLines = lines.filter(l => l.status === "pending");
  const remaining = roundMoney(total - target);

  if (remaining > 0 && nextMethod) {
    await upsertSinglePending({
      companyId: sale.companyId,
      saleId: sale.id,
      method: nextMethod,
      amount: remaining,
      notes: input.paymentNotes,
      cardInstallmentCount: input.cardInstallmentCount,
      actorUserId,
      existingPending: pendingLines,
      transaction
    });
  } else {
    await destroyPendingLines(pendingLines, transaction);
  }

  lines = await listSalePayments(sale.companyId, sale.id, transaction);
  const aggregate = calculateSalePaymentAggregate(total, lines);
  const paidOnly = lines.filter(l => l.status === "paid");

  const cache: PaymentCachePatch = {
    paymentStatus: aggregate.paymentStatus,
    paidAmount: aggregate.effectivePaid,
    paidAt: resolveSalePaidAtCache({
      paymentStatus: aggregate.paymentStatus,
      paidAt: input.paidAt,
      paidLines: paidOnly
    }),
    paymentMethod: nextMethod,
    cardInstallmentCount:
      nextMethod === "credit_card" ? input.cardInstallmentCount : null,
    paymentNotes: input.paymentNotes
  };

  return cache;
}

export type PaymentFinancialSummary = {
  totalAmount: number;
  effectivePaid: number;
  pendingAmount: number;
  remainingToReceive: number;
  remainingToAllocate: number;
  paymentStatus: InventoryPaymentStatus;
};

export function sumPendingAmount(
  payments: Array<{ amount: string | number; status: string }>
): number {
  let sum = 0;
  for (const row of payments || []) {
    if (row.status === "pending") {
      sum = roundMoney(sum + toMoney(row.amount));
    }
  }
  return sum;
}

export function buildPaymentFinancialSummary(
  totalAmount: string | number,
  payments: Array<{ amount: string | number; status: string }>
): PaymentFinancialSummary {
  const total = roundMoney(toMoney(totalAmount));
  const aggregate = calculateSalePaymentAggregate(total, payments);
  const pendingAmount = sumPendingAmount(payments);
  return {
    totalAmount: total,
    effectivePaid: aggregate.effectivePaid,
    pendingAmount,
    remainingToReceive: aggregate.pendingAmount,
    remainingToAllocate: roundMoney(
      total - aggregate.effectivePaid - pendingAmount
    ),
    paymentStatus: aggregate.paymentStatus
  };
}

/**
 * Cache legado a partir das lines.
 * Múltiplos métodos → paymentMethod=null (catálogo não aceita "multiple").
 */
export function deriveLegacyPaymentCache(
  payments: InventorySalePayment[],
  aggregate: { effectivePaid: number; paymentStatus: InventoryPaymentStatus }
): Omit<PaymentCachePatch, "paymentStatus" | "paidAmount"> {
  const active = payments.filter(p => p.status !== "reversed");
  const paidLines = active.filter(p => p.status === "paid");
  const methods = Array.from(new Set(active.map(p => p.method)));

  let paymentMethod: InventoryPaymentMethod | null = null;
  let cardInstallmentCount: number | null = null;
  let paymentNotes: string | null = null;

  if (methods.length === 1) {
    paymentMethod = methods[0] as InventoryPaymentMethod;
    if (paymentMethod === "credit_card") {
      const cardLines = active.filter(p => p.method === "credit_card");
      if (cardLines.length === 1) {
        cardInstallmentCount =
          cardLines[0].cardInstallmentCount == null
            ? null
            : Number(cardLines[0].cardInstallmentCount);
      } else {
        cardInstallmentCount = null;
      }
    }
    if (active.length === 1) {
      paymentNotes = active[0].notes ?? null;
    }
  }

  const paidAt = resolveSalePaidAtCache({
    paymentStatus: aggregate.paymentStatus,
    paidAt: null,
    paidLines
  });

  return {
    paidAt,
    paymentMethod,
    cardInstallmentCount,
    paymentNotes
  };
}

export function assertSaleTotalSupportsPayments(
  totalAmount: string | number,
  payments: Array<{ amount: string | number; status: string }>
): void {
  const summary = buildPaymentFinancialSummary(totalAmount, payments);
  if (summary.effectivePaid > summary.totalAmount) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_TOTAL_CONFLICT",
      400,
      "O total da venda não pode ser menor que o valor já recebido. Ajuste ou remova pagamentos antes."
    );
  }
  if (summary.remainingToAllocate < 0) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_TOTAL_CONFLICT",
      400,
      "O total da venda ficou abaixo dos pagamentos já distribuídos. Ajuste ou remova pagamentos pendentes antes."
    );
  }
}

export async function persistSalePaymentCache(
  sale: InventorySale,
  payments: InventorySalePayment[],
  transaction: Transaction
): Promise<PaymentCachePatch> {
  const aggregate = calculateSalePaymentAggregate(sale.totalAmount, payments);
  const legacy = deriveLegacyPaymentCache(payments, aggregate);
  const cache: PaymentCachePatch = {
    paymentStatus: aggregate.paymentStatus,
    paidAmount: aggregate.effectivePaid,
    ...legacy
  };
  await sale.update(cache, { transaction });
  return cache;
}

function isLegacySinglePendingIntention(payments: InventorySalePayment[]): boolean {
  if (payments.length === 0) return true;
  if (payments.length !== 1) return false;
  return payments[0].status === "pending";
}

/**
 * Intenção legada de rascunho (PUT /payment): no máximo um pending.
 * Não apaga paid (P3); se já houver recebido, bloqueia o fluxo legado.
 */
export async function syncDraftPaymentIntention(
  sale: InventorySale,
  input: {
    paymentMethod: InventoryPaymentMethod | null;
    cardInstallmentCount: number | null;
    paymentNotes: string | null;
    actorUserId?: number | null;
  },
  transaction: Transaction
): Promise<PaymentCachePatch> {
  if (sale.status !== "draft") {
    throw new AppError(
      "ERR_INVENTORY_SALE_NOT_DRAFT",
      400,
      "Somente rascunho pode sincronizar intenção de pagamento."
    );
  }

  const actorUserId = input.actorUserId ?? null;
  const total = roundMoney(toMoney(sale.totalAmount));
  let lines = await listSalePayments(sale.companyId, sale.id, transaction);

  if (lines.some(l => l.status === "paid")) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_USE_LINES_API",
      400,
      "Esta venda já possui pagamentos recebidos. Use a gestão de pagamentos do PDV."
    );
  }

  if (lines.length > 1) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_USE_LINES_API",
      400,
      "Esta venda já possui pagamentos múltiplos. Use a gestão de pagamentos do PDV."
    );
  }

  const pendingLines = lines.filter(l => l.status === "pending");

  if (!input.paymentMethod || total <= 0) {
    await destroyPendingLines(pendingLines, transaction);
  } else {
    await upsertSinglePending({
      companyId: sale.companyId,
      saleId: sale.id,
      method: input.paymentMethod,
      amount: total,
      notes: input.paymentNotes,
      cardInstallmentCount: input.cardInstallmentCount,
      actorUserId,
      existingPending: pendingLines,
      transaction
    });
  }

  lines = await listSalePayments(sale.companyId, sale.id, transaction);
  return persistSalePaymentCache(sale, lines, transaction);
}

/**
 * Após recálculo de total no draft:
 * - intenção legada (0–1 pending): redimensiona;
 * - alocação P3 explícita: apenas valida (não escolhe pending para reduzir).
 */
export async function syncDraftPendingAfterTotalChange(
  sale: InventorySale,
  transaction: Transaction
): Promise<void> {
  if (sale.status !== "draft") return;

  const lines = await listSalePayments(sale.companyId, sale.id, transaction);

  if (!isLegacySinglePendingIntention(lines)) {
    assertSaleTotalSupportsPayments(sale.totalAmount, lines);
    await persistSalePaymentCache(sale, lines, transaction);
    return;
  }

  const method = sale.paymentMethod;
  const notes = sale.paymentNotes ?? null;
  const installments =
    method === "credit_card" ? sale.cardInstallmentCount : null;

  await syncDraftPaymentIntention(
    sale,
    {
      paymentMethod: method,
      cardInstallmentCount: installments,
      paymentNotes: notes
    },
    transaction
  );
}

/**
 * Materializa o acerto de conclusão (settlePaymentOnComplete) em payment lines.
 */
export async function applyCompletePaymentSettlement(
  sale: InventorySale,
  input: {
    targetPaidAmount: number;
    paymentStatus: InventoryPaymentStatus;
    paidAt: Date | null;
    actorUserId?: number | null;
  },
  transaction: Transaction
): Promise<PaymentCachePatch> {
  return applyLegacyAbsolutePayment(
    sale,
    {
      targetPaidAmount: input.targetPaidAmount,
      paymentStatus: input.paymentStatus,
      paymentMethod: sale.paymentMethod,
      cardInstallmentCount: sale.cardInstallmentCount,
      paymentNotes: sale.paymentNotes ?? null,
      paidAt: input.paidAt,
      actorUserId: input.actorUserId
    },
    transaction
  );
}
