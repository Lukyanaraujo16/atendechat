import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import InventoryStoreCreditOverride from "../../models/InventoryStoreCreditOverride";
import InventorySale from "../../models/InventorySale";
import {
  generateStoreCreditSchedule,
  parseStoreCreditFrequency,
  assertCivilDateString,
  sumScheduleAmounts
} from "./inventoryStoreCreditSchedule";
import ValidateInventoryStoreCreditForCompleteService, {
  StoreCreditOverrideInput
} from "./ValidateInventoryStoreCreditForCompleteService";
import { roundMoney } from "./inventorySaleHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

export type StoreCreditScheduleInput = {
  frequency: unknown;
  installmentCount: unknown;
  firstDueDate: unknown;
};

export default async function CreateInventoryReceivableFromSaleService(input: {
  companyId: number;
  sale: InventorySale;
  financedAmount: number;
  schedule: StoreCreditScheduleInput;
  createdByUserId: number | null;
  override?: StoreCreditOverrideInput;
  transaction: Transaction;
}): Promise<InventoryReceivable> {
  const financedAmount = roundMoney(input.financedAmount);
  const frequency = parseStoreCreditFrequency(input.schedule.frequency);
  const firstDueDate = assertCivilDateString(input.schedule.firstDueDate);
  const installmentCount = Number(input.schedule.installmentCount);

  const validation = await ValidateInventoryStoreCreditForCompleteService({
    companyId: input.companyId,
    customerId: input.sale.customerId,
    financedAmount,
    override: input.override,
    transaction: input.transaction
  });

  const installments = generateStoreCreditSchedule({
    financedAmount,
    frequency,
    installmentCount,
    firstDueDate
  });

  if (roundMoney(sumScheduleAmounts(installments)) !== financedAmount) {
    throw new AppError(
      "ERR_INVENTORY_STORE_CREDIT_SCHEDULE_MISMATCH",
      400,
      "Soma das parcelas não confere com o valor financiado."
    );
  }

  const existing = await InventoryReceivable.findOne({
    where: {
      companyId: input.companyId,
      saleId: input.sale.id,
      originType: "store_credit",
      status: { [Op.in]: ["open", "partial", "paid"] }
    },
    transaction: input.transaction
  });
  if (existing) {
    throw new AppError(
      "ERR_INVENTORY_RECEIVABLE_ALREADY_EXISTS",
      400,
      "Já existe recebível de Crédito da Loja para esta venda."
    );
  }

  const receivable = await InventoryReceivable.create(
    {
      companyId: input.companyId,
      customerId: validation.customerId,
      saleId: input.sale.id,
      originType: "store_credit",
      originalAmount: financedAmount,
      openAmount: financedAmount,
      status: "open",
      scheduleFrequency: frequency,
      installmentCount: installments.length,
      firstDueDate,
      createdByUserId: input.createdByUserId
    },
    { transaction: input.transaction }
  );

  for (const row of installments) {
    await InventoryReceivableInstallment.create(
      {
        companyId: input.companyId,
        receivableId: receivable.id,
        sequence: row.sequence,
        dueDate: row.dueDate,
        originalAmount: row.amount,
        paidAmount: 0,
        openAmount: row.amount,
        status: "open"
      },
      { transaction: input.transaction }
    );
  }

  if (validation.overrideType && input.override?.authorizeOverride) {
    await InventoryStoreCreditOverride.create(
      {
        companyId: input.companyId,
        customerId: validation.customerId,
        saleId: input.sale.id,
        receivableId: receivable.id,
        overrideType: validation.overrideType,
        creditLimitAtMoment: validation.creditLimit,
        creditUsedAtMoment: validation.creditUsed,
        creditAvailableAtMoment: validation.creditAvailable,
        requestedAmount: financedAmount,
        exceededAmount: validation.exceededAmount,
        overdueOpenAmountAtMoment: validation.overdueOpenAmount,
        reason: normalizeOptionalString(input.override.reason),
        authorizedByUserId: Number(input.override.authorizedByUserId)
      },
      { transaction: input.transaction }
    );
  }

  // Garante customerId na sale
  if (input.sale.customerId !== validation.customerId) {
    await input.sale.update(
      { customerId: validation.customerId },
      { transaction: input.transaction }
    );
  }

  return receivable;
}
