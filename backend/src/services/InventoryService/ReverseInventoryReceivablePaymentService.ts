import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import InventoryReceivablePayment from "../../models/InventoryReceivablePayment";
import { installmentStatusFromAmounts } from "./inventoryReceivableHelpers";
import { roundMoney, toMoney } from "./inventorySaleHelpers";
import { normalizeOptionalString } from "./inventoryTenant";
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

export default async function ReverseInventoryReceivablePaymentService(input: {
  companyId: number;
  paymentId: number;
  reversedByUserId: number | null;
  reason?: unknown;
}) {
  const reverseReason = normalizeOptionalString(input.reason);

  const receivableId = await sequelize.transaction(async (t: Transaction) => {
    const payment = await InventoryReceivablePayment.findOne({
      where: { id: input.paymentId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!payment) {
      throw new AppError("ERR_INVENTORY_RECEIVABLE_PAYMENT_NOT_FOUND", 404);
    }
    if (payment.reversedAt) {
      throw new AppError(
        "ERR_INVENTORY_RECEIVABLE_PAYMENT_ALREADY_REVERSED",
        400,
        "Esta baixa já foi estornada."
      );
    }
    if (payment.reverseOfPaymentId != null) {
      throw new AppError(
        "ERR_INVENTORY_RECEIVABLE_PAYMENT_IS_REVERSAL",
        400,
        "Não é possível estornar um lançamento de estorno."
      );
    }
    if (toMoney(payment.amount) <= 0) {
      throw new AppError(
        "ERR_INVENTORY_RECEIVABLE_PAYMENT_NOT_REVERSIBLE",
        400,
        "Pagamento não pode ser estornado."
      );
    }

    const receivable = await InventoryReceivable.findOne({
      where: { id: payment.receivableId, companyId: input.companyId },
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
        "Recebível cancelado não aceita estorno."
      );
    }

    const installment = await InventoryReceivableInstallment.findOne({
      where: {
        id: payment.installmentId,
        companyId: input.companyId,
        receivableId: receivable.id
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!installment) {
      throw new AppError("ERR_INVENTORY_RECEIVABLE_INSTALLMENT_NOT_FOUND", 404);
    }
    if (installment.status === "cancelled") {
      throw new AppError(
        "ERR_INVENTORY_RECEIVABLE_INSTALLMENT_CANCELLED",
        400,
        "Parcela cancelada não aceita estorno."
      );
    }

    const amount = roundMoney(toMoney(payment.amount));
    const paidAmount = roundMoney(
      Math.max(0, toMoney(installment.paidAmount) - amount)
    );
    const openAmount = roundMoney(toMoney(installment.openAmount) + amount);
    if (openAmount > roundMoney(toMoney(installment.originalAmount)) + 0.001) {
      throw new AppError(
        "ERR_INVENTORY_RECEIVABLE_REVERSE_INCONSISTENT",
        400,
        "Estorno deixaria saldo inconsistente."
      );
    }

    const now = new Date();
    await payment.update(
      {
        reversedAt: now,
        reversedByUserId: input.reversedByUserId,
        reverseReason
      },
      { transaction: t }
    );

    await InventoryReceivablePayment.create(
      {
        companyId: input.companyId,
        receivableId: receivable.id,
        installmentId: installment.id,
        amount: roundMoney(-amount),
        paymentMethod: payment.paymentMethod,
        paidAt: now,
        notes: reverseReason,
        createdByUserId: input.reversedByUserId,
        reverseOfPaymentId: payment.id,
        reverseReason
      },
      { transaction: t }
    );

    const status = installmentStatusFromAmounts(
      toMoney(installment.originalAmount),
      paidAmount,
      openAmount
    );
    await installment.update(
      { paidAmount, openAmount, status },
      { transaction: t }
    );

    const allInstallments = await InventoryReceivableInstallment.findAll({
      where: { companyId: input.companyId, receivableId: receivable.id },
      transaction: t
    });
    const recvOpen = roundMoney(
      allInstallments
        .filter(i => i.status !== "cancelled")
        .reduce((acc, i) => acc + toMoney(i.openAmount), 0)
    );
    await receivable.update(
      {
        openAmount: recvOpen,
        status: simplifyReceivableStatus(allInstallments)
      },
      { transaction: t }
    );

    return receivable.id;
  });

  return GetInventoryReceivableService({
    companyId: input.companyId,
    receivableId
  });
}
