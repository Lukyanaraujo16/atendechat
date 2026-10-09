import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryProduct from "../../models/InventoryProduct";
import {
  assertInventorySaleIsDraft,
  buildProductSnapshot,
  findInventorySaleOrThrow,
  loadActiveInventoryProductOrThrow,
  recalculateInventorySaleTotals,
  roundMoney
} from "./inventorySaleHelpers";
import { computeItemDiscountAmount } from "./inventoryDiscountHelpers";
import {
  assertCanApplyDiscount,
  assertMerchandiseDiscountGovernance,
  buildMerchandiseDiscountSnapshot,
  DiscountAuthorizationInput,
  loadMaxDiscountPercent
} from "./inventoryDiscountGovernance";
import { syncDraftPendingAfterTotalChange } from "./inventorySalePaymentEngine";
import {
  buildInventorySaleItemIdentifierInclude,
  parseAndNormalizeIdentifiers,
  parseIdentifiersField,
  replaceSaleItemIdentifiers
} from "./inventorySaleItemIdentifiers";
import { parseRequiredDecimal } from "./inventoryTenant";

export default async function AddInventorySaleItemService(input: {
  companyId: number;
  saleId: number;
  body: {
    productId?: unknown;
    quantity?: unknown;
    unitPrice?: unknown;
    discountAmount?: unknown;
    discountType?: unknown;
    discountPercent?: unknown;
    discountAuthorization?: DiscountAuthorizationInput;
    identifiers?: unknown;
  };
  canApplyDiscount?: boolean;
}): Promise<InventorySaleItem> {
  return sequelize.transaction(async t => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t
    );
    assertInventorySaleIsDraft(sale, "receber itens");

    const productId = Number(input.body.productId);
    if (!Number.isFinite(productId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "productId obrigatório.");
    }

    const product = await loadActiveInventoryProductOrThrow(
      input.companyId,
      productId,
      t
    );
    const snapshot = buildProductSnapshot(product);

    const quantity = parseRequiredDecimal(input.body.quantity, "quantity");
    if (quantity <= 0) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "quantity deve ser maior que zero."
      );
    }

    const identifiersField = parseIdentifiersField(input.body.identifiers);
    const identifiers =
      identifiersField === "omitted"
        ? []
        : parseAndNormalizeIdentifiers(identifiersField, quantity);

    let { unitPrice } = snapshot;
    if (input.body.unitPrice !== undefined && input.body.unitPrice !== null) {
      unitPrice = parseRequiredDecimal(input.body.unitPrice, "unitPrice");
      if (unitPrice < 0) {
        throw new AppError("ERR_VALIDATION_ERROR", 400, "unitPrice inválido.");
      }
    }

    const computed = computeItemDiscountAmount({
      discountType: input.body.discountType,
      discountAmount: input.body.discountAmount,
      discountPercent: input.body.discountPercent,
      unitPrice,
      quantity
    });

    assertCanApplyDiscount({
      canApplyDiscount: input.canApplyDiscount !== false,
      discountAmount: computed.discountAmount
    });

    const persistType =
      input.body.discountType === undefined ||
      input.body.discountType === null ||
      input.body.discountType === ""
        ? computed.discountAmount > 0
          ? "fixed"
          : null
        : computed.discountType;

    const item = await InventorySaleItem.create(
      {
        companyId: input.companyId,
        saleId: sale.id,
        productId: snapshot.productId,
        productName: snapshot.productName,
        productSku: snapshot.productSku,
        unit: snapshot.unit,
        unitPrice: roundMoney(unitPrice),
        costPrice: snapshot.costPrice,
        quantity,
        discountType: persistType,
        discountPercent: computed.discountPercent,
        discountAmount: computed.discountAmount,
        totalAmount: computed.lineTotal,
        trackStock: snapshot.trackStock
      },
      { transaction: t }
    );

    await replaceSaleItemIdentifiers({
      companyId: input.companyId,
      saleItemId: item.id,
      identifiers,
      transaction: t
    });

    await recalculateInventorySaleTotals(sale.id, input.companyId, t);
    await sale.reload({ transaction: t });

    const maxAllowedPercent = await loadMaxDiscountPercent(input.companyId, t);
    const items = await InventorySaleItem.findAll({
      where: { saleId: sale.id, companyId: input.companyId },
      transaction: t
    });
    const snapshotDisc = buildMerchandiseDiscountSnapshot({
      items,
      globalDiscountType: sale.globalDiscountType,
      globalDiscountAmount: sale.globalDiscountAmount,
      globalDiscountPercent: sale.globalDiscountPercent,
      maxAllowedPercent
    });
    await assertMerchandiseDiscountGovernance({
      companyId: input.companyId,
      sale,
      snapshot: snapshotDisc,
      authorization: input.body.discountAuthorization,
      actorUserId: input.body.discountAuthorization?.authorizedByUserId,
      transaction: t
    });

    await syncDraftPendingAfterTotalChange(sale, t);
    return item.reload({
      transaction: t,
      include: [
        {
          model: InventoryProduct,
          attributes: ["id", "name", "sku", "active"],
          required: false
        },
        buildInventorySaleItemIdentifierInclude(input.companyId)
      ]
    });
  });
}
