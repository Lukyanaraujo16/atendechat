import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventorySettings from "../../models/InventorySettings";
import {
  getCustomerCreditSnapshot,
  lockInventoryCustomerForUpdate
} from "./inventoryCustomerCredit";
import { roundMoney } from "./inventorySaleHelpers";

export type StoreCreditOverrideInput = {
  authorizeOverride?: boolean;
  authorizedByUserId?: number | null;
  reason?: string | null;
  canAuthorizeOverride?: boolean;
};

export type StoreCreditValidationResult = {
  customerId: number;
  financedAmount: number;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  overdueOpenAmount: number;
  needsLimitOverride: boolean;
  needsOverdueOverride: boolean;
  exceededAmount: number;
  overrideType: "limit" | "overdue" | "limit_and_overdue" | null;
};

export default async function ValidateInventoryStoreCreditForCompleteService(input: {
  companyId: number;
  customerId: number | null | undefined;
  financedAmount: number;
  override?: StoreCreditOverrideInput;
  transaction: Transaction;
}): Promise<StoreCreditValidationResult> {
  const financedAmount = roundMoney(input.financedAmount);
  if (financedAmount <= 0) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Valor de Crédito da Loja inválido."
    );
  }

  if (input.customerId == null) {
    throw new AppError(
      "ERR_INVENTORY_STORE_CREDIT_CUSTOMER_REQUIRED",
      400,
      "Crédito da Loja exige Cliente cadastrado."
    );
  }

  const customer = await lockInventoryCustomerForUpdate(
    input.companyId,
    input.customerId,
    input.transaction
  );

  if (!customer.isActive) {
    throw new AppError(
      "ERR_INVENTORY_STORE_CREDIT_CUSTOMER_INACTIVE",
      400,
      "Cliente inativo não pode usar Crédito da Loja."
    );
  }

  const credit = await getCustomerCreditSnapshot(
    input.companyId,
    customer.id,
    input.transaction
  );

  const settings = await InventorySettings.findOne({
    where: { companyId: input.companyId },
    transaction: input.transaction,
    lock: input.transaction.LOCK.UPDATE
  });

  const blockWhenOverdue = settings?.blockStoreCreditWhenOverdue !== false;
  const needsLimitOverride = financedAmount > credit.creditAvailable;
  const needsOverdueOverride =
    blockWhenOverdue && credit.overdueOpenAmount > 0;

  if (needsLimitOverride || needsOverdueOverride) {
    const override = input.override;
    const authorized =
      override?.authorizeOverride === true &&
      override?.canAuthorizeOverride === true &&
      override?.authorizedByUserId != null;

    if (!authorized) {
      if (needsLimitOverride && needsOverdueOverride) {
        throw new AppError(
          "ERR_INVENTORY_STORE_CREDIT_LIMIT_AND_OVERDUE",
          400,
          "Crédito insuficiente e há saldo vencido. É necessária autorização."
        );
      }
      if (needsLimitOverride) {
        throw new AppError(
          "ERR_INVENTORY_STORE_CREDIT_LIMIT",
          400,
          "Valor excede o crédito disponível do Cliente."
        );
      }
      throw new AppError(
        "ERR_INVENTORY_STORE_CREDIT_OVERDUE",
        400,
        "Cliente possui saldo vencido. Nova compra em Crédito da Loja bloqueada."
      );
    }
  }

  let overrideType: StoreCreditValidationResult["overrideType"] = null;
  if (needsLimitOverride && needsOverdueOverride) {
    overrideType = "limit_and_overdue";
  } else if (needsLimitOverride) {
    overrideType = "limit";
  } else if (needsOverdueOverride) {
    overrideType = "overdue";
  }

  return {
    customerId: customer.id,
    financedAmount,
    creditLimit: credit.creditLimit,
    creditUsed: credit.creditUsed,
    creditAvailable: credit.creditAvailable,
    overdueOpenAmount: credit.overdueOpenAmount,
    needsLimitOverride,
    needsOverdueOverride,
    exceededAmount: needsLimitOverride
      ? roundMoney(financedAmount - credit.creditAvailable)
      : 0,
    overrideType
  };
}
