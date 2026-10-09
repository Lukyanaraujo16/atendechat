import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySale from "../../models/InventorySale";
import InventorySaleItem from "../../models/InventorySaleItem";
import {
  assertInventorySaleIsDraft,
  findInventorySaleOrThrow,
  recalculateInventorySaleTotals
} from "./inventorySaleHelpers";
import { computeGlobalDiscountAmount } from "./inventoryDiscountHelpers";
import {
  assertCanApplyDiscount,
  assertMerchandiseDiscountGovernance,
  buildMerchandiseDiscountSnapshot,
  DiscountAuthorizationInput,
  loadMaxDiscountPercent
} from "./inventoryDiscountGovernance";
import { syncDraftPendingAfterTotalChange } from "./inventorySalePaymentEngine";
import { toMoney } from "./inventorySaleHelpers";

export default async function UpdateInventorySaleGlobalDiscountService(input: {
  companyId: number;
  saleId: number;
  body: {
    globalDiscountType?: unknown;
    globalDiscountAmount?: unknown;
    globalDiscountPercent?: unknown;
    clear?: unknown;
    discountAuthorization?: DiscountAuthorizationInput;
  };
  canApplyDiscount?: boolean;
}): Promise<InventorySale> {
  return sequelize.transaction(async t => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t,
      t.LOCK.UPDATE
    );
    assertInventorySaleIsDraft(sale, "ter desconto da venda alterado");

    const clear =
      input.body.clear === true ||
      input.body.clear === "true" ||
      input.body.clear === 1 ||
      input.body.clear === "1" ||
      input.body.globalDiscountType === null ||
      input.body.globalDiscountType === "";

    const items = await InventorySaleItem.findAll({
      where: { saleId: sale.id, companyId: input.companyId },
      transaction: t
    });
    const merchandiseAfterItemDiscounts = items.reduce((acc, item) => {
      return acc + toMoney(item.totalAmount);
    }, 0);

    let nextType: unknown = sale.globalDiscountType;
    let nextAmount: unknown = sale.globalDiscountAmount;
    let nextPercent: unknown = sale.globalDiscountPercent;

    if (clear) {
      nextType = null;
      nextAmount = 0;
      nextPercent = null;
    } else {
      if (input.body.globalDiscountType !== undefined) {
        nextType = input.body.globalDiscountType;
      }
      if (input.body.globalDiscountAmount !== undefined) {
        nextAmount = input.body.globalDiscountAmount;
      }
      if (input.body.globalDiscountPercent !== undefined) {
        nextPercent = input.body.globalDiscountPercent;
      }
      if (
        nextType === undefined ||
        nextType === null ||
        nextType === ""
      ) {
        throw new AppError(
          "ERR_INVENTORY_GLOBAL_DISCOUNT_TYPE_REQUIRED",
          400,
          "Informe o tipo do desconto da venda (fixed ou percentage)."
        );
      }
    }

    const computed = computeGlobalDiscountAmount({
      globalDiscountType: clear ? null : nextType,
      globalDiscountAmount: nextAmount,
      globalDiscountPercent: nextPercent,
      merchandiseAfterItemDiscounts
    });

    assertCanApplyDiscount({
      canApplyDiscount: input.canApplyDiscount !== false,
      discountAmount: computed.globalDiscountAmount
    });

    await sale.update(
      {
        globalDiscountType: computed.globalDiscountType,
        globalDiscountPercent: computed.globalDiscountPercent,
        globalDiscountAmount: computed.globalDiscountAmount
      },
      { transaction: t }
    );

    await recalculateInventorySaleTotals(sale.id, input.companyId, t);
    await sale.reload({ transaction: t });

    const maxAllowedPercent = await loadMaxDiscountPercent(input.companyId, t);
    const refreshedItems = await InventorySaleItem.findAll({
      where: { saleId: sale.id, companyId: input.companyId },
      transaction: t
    });
    const snapshot = buildMerchandiseDiscountSnapshot({
      items: refreshedItems,
      globalDiscountType: sale.globalDiscountType,
      globalDiscountAmount: sale.globalDiscountAmount,
      globalDiscountPercent: sale.globalDiscountPercent,
      maxAllowedPercent
    });

    await assertMerchandiseDiscountGovernance({
      companyId: input.companyId,
      sale,
      snapshot,
      authorization: input.body.discountAuthorization,
      transaction: t
    });

    await syncDraftPendingAfterTotalChange(sale, t);
    return sale.reload({ transaction: t });
  });
}
