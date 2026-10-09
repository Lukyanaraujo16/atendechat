import { Op, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryCustomer from "../../models/InventoryCustomer";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

export type CustomerCreditSnapshot = {
  customerId: number;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  openAmount: number;
  overdueOpenAmount: number;
};

function todayCivilDate(now: Date = new Date()): string {
  // Data civil no fuso operacional padrão do módulo (-03:00).
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  return fmt.format(now);
}

export function computeCreditAvailable(
  creditLimit: number,
  creditUsed: number
): number {
  return Math.max(roundMoney(creditLimit - creditUsed), 0);
}

/**
 * Crédito utilizado = soma de openAmount de parcelas open|partial
 * de recebíveis originType=store_credit (não cancelados).
 */
export async function computeCustomerCreditUsed(
  companyId: number,
  customerId: number,
  transaction?: Transaction
): Promise<{ creditUsed: number; openAmount: number; overdueOpenAmount: number }> {
  const today = todayCivilDate();
  const installments = await InventoryReceivableInstallment.findAll({
    where: {
      companyId,
      status: { [Op.in]: ["open", "partial"] }
    },
    include: [
      {
        model: InventoryReceivable,
        required: true,
        where: {
          companyId,
          customerId,
          originType: "store_credit",
          status: { [Op.in]: ["open", "partial"] }
        },
        attributes: ["id"]
      }
    ],
    transaction
  });

  let creditUsed = 0;
  let overdueOpenAmount = 0;
  for (const row of installments) {
    const open = roundMoney(toMoney(row.openAmount));
    creditUsed = roundMoney(creditUsed + open);
    if (String(row.dueDate) < today) {
      overdueOpenAmount = roundMoney(overdueOpenAmount + open);
    }
  }

  return {
    creditUsed,
    openAmount: creditUsed,
    overdueOpenAmount
  };
}

export async function lockInventoryCustomerForUpdate(
  companyId: number,
  customerId: number,
  transaction: Transaction
): Promise<InventoryCustomer> {
  const customer = await InventoryCustomer.findOne({
    where: { id: customerId, companyId },
    transaction,
    lock: transaction.LOCK.UPDATE
  });
  if (!customer) {
    throw new AppError("ERR_INVENTORY_CUSTOMER_NOT_FOUND", 404);
  }
  return customer;
}

export async function getCustomerCreditSnapshot(
  companyId: number,
  customerId: number,
  transaction?: Transaction
): Promise<CustomerCreditSnapshot> {
  const customer = transaction
    ? await lockInventoryCustomerForUpdate(companyId, customerId, transaction)
    : await InventoryCustomer.findOne({
        where: { id: customerId, companyId },
        transaction
      });

  if (!customer) {
    throw new AppError("ERR_INVENTORY_CUSTOMER_NOT_FOUND", 404);
  }

  const creditLimit = roundMoney(toMoney(customer.creditLimit));
  const { creditUsed, openAmount, overdueOpenAmount } =
    await computeCustomerCreditUsed(companyId, customerId, transaction);

  return {
    customerId: customer.id,
    creditLimit,
    creditUsed,
    creditAvailable: computeCreditAvailable(creditLimit, creditUsed),
    openAmount,
    overdueOpenAmount
  };
}
