import { Op, Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import InventoryReceivablePayment from "../../models/InventoryReceivablePayment";
import { parseReceivablePaymentMethod } from "./inventoryPaymentHelpers";
import {
  allocateAmountAcrossInstallments,
  assertPositiveReceivableAmount,
  installmentStatusFromAmounts,
  receivableStatusFromInstallments,
  todayCivilDate
} from "./inventoryReceivableHelpers";
import { roundMoney, toMoney } from "./inventorySaleHelpers";
import { normalizeOptionalString, parseOptionalDateQuery } from "./inventoryTenant";
import GetInventoryReceivableService from "./GetInventoryReceivableService";

function simplifyReceivableStatus(
  installments: InventoryReceivableInstallment[]
): "open" | "partial" | "paid" | "cancelled" {
  const active = installments.filter(i => i.status !== "cancelled");
  if (active.length === 0) return "cancelled";
  const openSum = roundMoney(
    active.reduce((acc, i) => acc + toMoney(i.openAmount), 0)
  );
  if (openSum <= 0) return "paid";
  const anyPaid = active.some(
    i => toMoney(i.paidAmount) > 0 || i.status === "paid" || i.status === "partial"
  );
  return anyPaid ? "partial" : "open";
}

export default async function CreateInventoryReceivablePaymentService(input: {
  companyId: number;
  body: {
    receivableId?: unknown;
    installmentIds?: unknown;
    amount?: unknown;
    paymentMethod?: unknown;
    paidAt?: unknown;
    notes?: unknown;
  };
  createdByUserId: number | null;
}) {
  const amount = assertPositiveReceivableAmount(input.body.amount);
  const paymentMethod = parseReceivablePaymentMethod(input.body.paymentMethod);
  const notes = normalizeOptionalString(input.body.notes);
  const paidAt =
    input.body.paidAt !== undefined &&
    input.body.paidAt !== null &&
    input.body.paidAt !== ""
      ? parseOptionalDateQuery(input.body.paidAt) ?? new Date()
      : new Date();

  const receivableId = Number(input.body.receivableId);
  if (!Number.isFinite(receivableId)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "receivableId inválido.");
  }

  const rawIds = input.body.installmentIds;
  let installmentIds: number[] | null = null;
  if (Array.isArray(rawIds) && rawIds.length > 0) {
    installmentIds = rawIds.map(Number).filter(n => Number.isFinite(n));
  }

  let lastPaymentAllocations: Array<{
    installmentId: number;
    sequence: number;
    dueDate: string;
    amount: number;
    openAmountAfter: number;
  }> = [];

  await sequelize.transaction(async (t: Transaction) => {
    const receivable = await InventoryReceivable.findOne({
      where: { id: receivableId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!receivable) {
      throw new AppError("ERR_INVENTORY_RECEIVABLE_NOT_FOUND", 404);
    }
    if (receivable.status === "cancelled") {
      throw new AppError(
        "ERR_INVENTORY_RECEIVABLE_CANCELLED",
        400,
        "Recebível cancelado não aceita baixas."
      );
    }
    if (receivable.status === "paid") {
      throw new AppError(
        "ERR_INVENTORY_RECEIVABLE_ALREADY_PAID",
        400,
        "Recebível já está pago."
      );
    }

    const where: any = {
      companyId: input.companyId,
      receivableId: receivable.id,
      status: { [Op.in]: ["open", "partial"] }
    };
    if (installmentIds) {
      where.id = { [Op.in]: installmentIds };
    }

    const installments = await InventoryReceivableInstallment.findAll({
      where,
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!installments.length) {
      throw new AppError(
        "ERR_INVENTORY_RECEIVABLE_NO_OPEN_INSTALLMENTS",
        400,
        "Não há parcelas em aberto para receber."
      );
    }

    for (const inst of installments) {
      if (Number(inst.receivableId) !== Number(receivable.id)) {
        throw new AppError(
          "ERR_INVENTORY_RECEIVABLE_INSTALLMENT_MISMATCH",
          400,
          "Parcela não pertence a este recebível."
        );
      }
    }

    const allocations = allocateAmountAcrossInstallments(
      installments,
      amount,
      todayCivilDate()
    );

    lastPaymentAllocations = [];
    for (const alloc of allocations) {
      const inst = installments.find(i => i.id === alloc.installmentId)!;
      const open = roundMoney(toMoney(inst.openAmount));
      if (alloc.amount > open) {
        throw new AppError(
          "ERR_INVENTORY_RECEIVABLE_OVERPAYMENT",
          400,
          "Valor excede o saldo da parcela."
        );
      }

      await InventoryReceivablePayment.create(
        {
          companyId: input.companyId,
          receivableId: receivable.id,
          installmentId: inst.id,
          amount: alloc.amount,
          paymentMethod,
          paidAt,
          notes,
          createdByUserId: input.createdByUserId
        },
        { transaction: t }
      );

      const paidAmount = roundMoney(toMoney(inst.paidAmount) + alloc.amount);
      const openAmount = roundMoney(open - alloc.amount);
      const status = installmentStatusFromAmounts(
        toMoney(inst.originalAmount),
        paidAmount,
        openAmount
      );
      await inst.update(
        { paidAmount, openAmount, status },
        { transaction: t }
      );
      lastPaymentAllocations.push({
        installmentId: inst.id,
        sequence: inst.sequence,
        dueDate: String(inst.dueDate),
        amount: alloc.amount,
        openAmountAfter: openAmount
      });
    }

    const allInstallments = await InventoryReceivableInstallment.findAll({
      where: { companyId: input.companyId, receivableId: receivable.id },
      transaction: t
    });
    const openAmount = roundMoney(
      allInstallments
        .filter(i => i.status !== "cancelled")
        .reduce((acc, i) => acc + toMoney(i.openAmount), 0)
    );
    await receivable.update(
      {
        openAmount,
        status: simplifyReceivableStatus(allInstallments)
      },
      { transaction: t }
    );

    void receivableStatusFromInstallments;
  });

  const detail = await GetInventoryReceivableService({
    companyId: input.companyId,
    receivableId
  });
  return {
    ...detail,
    lastPaymentAllocations,
    receivedAmount: amount
  };
}
