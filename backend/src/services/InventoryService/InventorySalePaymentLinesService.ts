import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySale from "../../models/InventorySale";
import InventorySalePayment from "../../models/InventorySalePayment";
import {
  InventoryPaymentMethod,
  parseOptionalPaidAt,
  parseOptionalPaymentMethod,
  parsePaidAmount,
  resolveCardInstallmentCount
} from "./inventoryPaymentHelpers";
import {
  assertSaleTotalSupportsPayments,
  bootstrapLegacyPaymentsIfNeeded,
  buildPaymentFinancialSummary,
  listSalePayments,
  persistSalePaymentCache,
  PaymentFinancialSummary
} from "./inventorySalePaymentEngine";
import {
  findInventorySaleOrThrow,
  roundMoney,
  toMoney
} from "./inventorySaleHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

export type PaymentLineDTO = {
  id: number;
  companyId: number;
  saleId: number;
  method: string;
  amount: number;
  status: string;
  paidAt: Date | null;
  notes: string | null;
  cardInstallmentCount: number | null;
  createdByUserId: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PaymentsBundle = {
  payments: PaymentLineDTO[];
  summary: PaymentFinancialSummary;
};

function toDTO(row: InventorySalePayment): PaymentLineDTO {
  return {
    id: row.id,
    companyId: row.companyId,
    saleId: row.saleId,
    method: row.method,
    amount: roundMoney(toMoney(row.amount)),
    status: row.status,
    paidAt: row.paidAt,
    notes: row.notes ?? null,
    cardInstallmentCount:
      row.cardInstallmentCount == null ? null : Number(row.cardInstallmentCount),
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

async function bundleForSale(
  sale: InventorySale,
  transaction: Transaction
): Promise<PaymentsBundle> {
  const payments = await listSalePayments(sale.companyId, sale.id, transaction);
  return {
    payments: payments.map(toDTO),
    summary: buildPaymentFinancialSummary(sale.totalAmount, payments)
  };
}

function assertMutableSale(sale: InventorySale): void {
  if (sale.status === "cancelled") {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_CANCELLED",
      400,
      "Não é possível alterar pagamentos de venda cancelada."
    );
  }
}

/**
 * store_credit só pode existir em draft — receivable nasce no complete.
 * Pós-venda: Contas a Receber; nunca payment line órfã.
 */
function assertStoreCreditAllowedOnSale(
  sale: InventorySale,
  method: string
): void {
  if (method !== "store_credit") return;
  if (sale.status !== "draft") {
    throw new AppError(
      "ERR_INVENTORY_STORE_CREDIT_AFTER_COMPLETE",
      400,
      "Crédito da Loja só pode ser definido antes de concluir a venda. Após a conclusão, use Contas a Receber."
    );
  }
}

function parseLineStatus(raw: unknown): "pending" | "paid" {
  const status = String(raw ?? "").trim();
  if (status !== "pending" && status !== "paid") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "status do pagamento deve ser pendente ou pago."
    );
  }
  return status;
}

function parsePositiveAmount(raw: unknown): number {
  const amount = parsePaidAmount(raw);
  if (amount <= 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "O valor do pagamento deve ser maior que zero."
    );
  }
  return amount;
}

function resolveMethodAndInstallments(body: {
  method?: unknown;
  cardInstallmentCount?: unknown;
}): { method: InventoryPaymentMethod; cardInstallmentCount: number | null } {
  const method = parseOptionalPaymentMethod(body.method);
  if (!method) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Forma de pagamento é obrigatória."
    );
  }
  const countProvided = Object.prototype.hasOwnProperty.call(
    body,
    "cardInstallmentCount"
  );
  const cardInstallmentCount = resolveCardInstallmentCount({
    paymentMethod: method,
    raw: body.cardInstallmentCount,
    rawProvided: countProvided,
    existing: null,
    preserveHistoricalNull: false
  });
  return { method, cardInstallmentCount };
}

function assertCreditCardPaid(
  method: InventoryPaymentMethod,
  status: "pending" | "paid"
): void {
  if (method === "credit_card" && status !== "paid") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Cartão de crédito deve ser registrado como pagamento recebido."
    );
  }
}

function assertAllocationFits(
  totalAmount: string | number,
  payments: Array<{ amount: string | number; status: string }>
): void {
  const summary = buildPaymentFinancialSummary(totalAmount, payments);
  if (summary.effectivePaid > summary.totalAmount) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_OVERPAYMENT",
      400,
      "O valor recebido não pode ser maior que o total da venda."
    );
  }
  if (summary.remainingToAllocate < 0) {
    throw new AppError(
      "ERR_INVENTORY_SALE_PAYMENT_OVERALLOCATION",
      400,
      "A soma dos pagamentos ultrapassa o total da venda."
    );
  }
}

export async function listInventorySalePayments(input: {
  companyId: number;
  saleId: number;
}): Promise<PaymentsBundle> {
  return sequelize.transaction(async (t: Transaction) => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t
    );
    await bootstrapLegacyPaymentsIfNeeded(sale, t, null);
    const payments = await listSalePayments(sale.companyId, sale.id, t);
    if (payments.length > 0) {
      await persistSalePaymentCache(sale, payments, t);
    }
    return bundleForSale(sale, t);
  });
}

export async function addInventorySalePayment(input: {
  companyId: number;
  saleId: number;
  body: Record<string, unknown>;
  actorUserId: number | null;
}): Promise<PaymentsBundle> {
  return sequelize.transaction(async (t: Transaction) => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t,
      t.LOCK.UPDATE
    );
    assertMutableSale(sale);

    const { method, cardInstallmentCount } = resolveMethodAndInstallments(
      input.body
    );
    assertStoreCreditAllowedOnSale(sale, method);
    const amount = parsePositiveAmount(input.body.amount);
    let status = parseLineStatus(input.body.status ?? "paid");
    if (method === "credit_card") status = "paid";
    // Crédito da Loja representa valor financiado — permanece pending até gerar recebível.
    if (method === "store_credit") status = "pending";
    assertCreditCardPaid(method, status);

    const notes =
      input.body.notes !== undefined
        ? normalizeOptionalString(input.body.notes)
        : null;
    const paidAt =
      status === "paid"
        ? parseOptionalPaidAt(input.body.paidAt) ?? new Date()
        : null;

    const existing = await listSalePayments(sale.companyId, sale.id, t);
    const projected = [
      ...existing.map(r => ({ amount: r.amount, status: r.status })),
      { amount, status }
    ];
    assertAllocationFits(sale.totalAmount, projected);

    await InventorySalePayment.create(
      {
        companyId: sale.companyId,
        saleId: sale.id,
        method,
        amount,
        status,
        paidAt,
        notes,
        cardInstallmentCount:
          method === "credit_card" ? cardInstallmentCount : null,
        createdByUserId: input.actorUserId
      },
      { transaction: t }
    );

    const payments = await listSalePayments(sale.companyId, sale.id, t);
    await persistSalePaymentCache(sale, payments, t);
    return bundleForSale(sale, t);
  });
}

export async function updatePendingInventorySalePayment(input: {
  companyId: number;
  saleId: number;
  paymentId: number;
  body: Record<string, unknown>;
  actorUserId: number | null;
}): Promise<PaymentsBundle> {
  return sequelize.transaction(async (t: Transaction) => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t,
      t.LOCK.UPDATE
    );
    assertMutableSale(sale);

    const payment = await InventorySalePayment.findOne({
      where: {
        id: input.paymentId,
        saleId: sale.id,
        companyId: input.companyId
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!payment) {
      throw new AppError("ERR_INVENTORY_SALE_PAYMENT_NOT_FOUND", 404);
    }
    if (payment.status !== "pending") {
      throw new AppError(
        "ERR_INVENTORY_SALE_PAYMENT_IMMUTABLE",
        400,
        "Pagamento já recebido não pode ser alterado."
      );
    }
    if (payment.method === "store_credit" && sale.status !== "draft") {
      throw new AppError(
        "ERR_INVENTORY_STORE_CREDIT_AFTER_COMPLETE",
        400,
        "Crédito da Loja desta venda não pode ser editado pelo fluxo de pagamentos. Use Contas a Receber."
      );
    }

    const methodProvided = input.body.method !== undefined;
    const amountProvided = input.body.amount !== undefined;
    const notesProvided = input.body.notes !== undefined;
    const countProvided = Object.prototype.hasOwnProperty.call(
      input.body,
      "cardInstallmentCount"
    );

    let method = payment.method as InventoryPaymentMethod;
    if (methodProvided) {
      const parsed = parseOptionalPaymentMethod(input.body.method);
      if (!parsed) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "Forma de pagamento é obrigatória."
        );
      }
      method = parsed;
    }
    assertStoreCreditAllowedOnSale(sale, method);

    const amount = amountProvided
      ? parsePositiveAmount(input.body.amount)
      : roundMoney(toMoney(payment.amount));

    const cardInstallmentCount = resolveCardInstallmentCount({
      paymentMethod: method,
      raw: input.body.cardInstallmentCount,
      rawProvided: countProvided,
      existing: payment.cardInstallmentCount,
      preserveHistoricalNull:
        !countProvided && payment.method === "credit_card"
    });

    if (method === "credit_card") {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Cartão de crédito deve ser registrado como pagamento recebido."
      );
    }
    if (method === "store_credit" && payment.status !== "pending") {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Crédito da Loja deve permanecer pendente até a geração do recebível."
      );
    }

    const notes = notesProvided
      ? normalizeOptionalString(input.body.notes)
      : payment.notes ?? null;

    const others = (
      await listSalePayments(sale.companyId, sale.id, t)
    ).filter(r => r.id !== payment.id);
    assertAllocationFits(sale.totalAmount, [
      ...others.map(r => ({ amount: r.amount, status: r.status })),
      { amount, status: "pending" }
    ]);

    await payment.update(
      {
        method,
        amount,
        notes,
        cardInstallmentCount: null,
        status: "pending",
        paidAt: null
      },
      { transaction: t }
    );

    const payments = await listSalePayments(sale.companyId, sale.id, t);
    await persistSalePaymentCache(sale, payments, t);
    return bundleForSale(sale, t);
  });
}

export async function deletePendingInventorySalePayment(input: {
  companyId: number;
  saleId: number;
  paymentId: number;
}): Promise<PaymentsBundle> {
  return sequelize.transaction(async (t: Transaction) => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t,
      t.LOCK.UPDATE
    );
    assertMutableSale(sale);

    const payment = await InventorySalePayment.findOne({
      where: {
        id: input.paymentId,
        saleId: sale.id,
        companyId: input.companyId
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!payment) {
      throw new AppError("ERR_INVENTORY_SALE_PAYMENT_NOT_FOUND", 404);
    }
    if (payment.status !== "pending") {
      throw new AppError(
        "ERR_INVENTORY_SALE_PAYMENT_IMMUTABLE",
        400,
        "Pagamento já recebido não pode ser excluído."
      );
    }
    if (payment.method === "store_credit" && sale.status !== "draft") {
      throw new AppError(
        "ERR_INVENTORY_STORE_CREDIT_AFTER_COMPLETE",
        400,
        "Crédito da Loja desta venda não pode ser removido pelo fluxo de pagamentos. Use Contas a Receber."
      );
    }

    await payment.destroy({ transaction: t });
    const payments = await listSalePayments(sale.companyId, sale.id, t);
    await persistSalePaymentCache(sale, payments, t);
    return bundleForSale(sale, t);
  });
}

export async function settleInventorySalePayment(input: {
  companyId: number;
  saleId: number;
  paymentId: number;
  body?: Record<string, unknown>;
  actorUserId: number | null;
}): Promise<PaymentsBundle> {
  return sequelize.transaction(async (t: Transaction) => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t,
      t.LOCK.UPDATE
    );
    assertMutableSale(sale);

    const payment = await InventorySalePayment.findOne({
      where: {
        id: input.paymentId,
        saleId: sale.id,
        companyId: input.companyId
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!payment) {
      throw new AppError("ERR_INVENTORY_SALE_PAYMENT_NOT_FOUND", 404);
    }
    if (payment.status !== "pending") {
      throw new AppError(
        "ERR_INVENTORY_SALE_PAYMENT_IMMUTABLE",
        400,
        "Somente pagamento pendente pode ser marcado como recebido."
      );
    }
    if (payment.method === "store_credit") {
      throw new AppError(
        "ERR_INVENTORY_STORE_CREDIT_NOT_CASH",
        400,
        "Crédito da Loja não pode ser liquidado como pagamento à vista. Use Contas a Receber."
      );
    }

    const paidAt =
      parseOptionalPaidAt(input.body?.paidAt) ?? new Date();

    const others = (
      await listSalePayments(sale.companyId, sale.id, t)
    ).filter(r => r.id !== payment.id);
    assertAllocationFits(sale.totalAmount, [
      ...others.map(r => ({ amount: r.amount, status: r.status })),
      { amount: payment.amount, status: "paid" }
    ]);

    await payment.update(
      {
        status: "paid",
        paidAt
      },
      { transaction: t }
    );

    const payments = await listSalePayments(sale.companyId, sale.id, t);
    await persistSalePaymentCache(sale, payments, t);
    return bundleForSale(sale, t);
  });
}

/** Validação final do complete em modo lines (sob lock). */
export async function validateExplicitPaymentLinesForComplete(
  sale: InventorySale,
  transaction: Transaction,
  options: { requireFullAllocation: boolean }
): Promise<PaymentFinancialSummary> {
  const payments = await listSalePayments(sale.companyId, sale.id, transaction);
  assertSaleTotalSupportsPayments(sale.totalAmount, payments);
  const summary = buildPaymentFinancialSummary(sale.totalAmount, payments);

  if (options.requireFullAllocation) {
    if (summary.remainingToAllocate !== 0) {
      throw new AppError(
        "ERR_INVENTORY_SALE_PAYMENT_INCOMPLETE_ALLOCATION",
        400,
        `Falta distribuir R$ ${summary.remainingToAllocate
          .toFixed(2)
          .replace(".", ",")} entre as formas de pagamento.`
      );
    }
  }

  return summary;
}

export { assertSaleTotalSupportsPayments };
