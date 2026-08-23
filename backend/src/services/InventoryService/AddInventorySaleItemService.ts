import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryProduct from "../../models/InventoryProduct";
import {
  assertInventorySaleIsDraft,
  buildProductSnapshot,
  computeLineTotal,
  findInventorySaleOrThrow,
  loadActiveInventoryProductOrThrow,
  recalculateInventorySaleTotals,
  roundMoney
} from "./inventorySaleHelpers";
import {
  buildInventorySaleItemIdentifierInclude,
  parseAndNormalizeIdentifiers,
  parseIdentifiersField,
  replaceSaleItemIdentifiers
} from "./inventorySaleItemIdentifiers";
import { parseDecimal, parseRequiredDecimal } from "./inventoryTenant";

export default async function AddInventorySaleItemService(input: {
  companyId: number;
  saleId: number;
  body: {
    productId?: unknown;
    quantity?: unknown;
    unitPrice?: unknown;
    discountAmount?: unknown;
    identifiers?: unknown;
  };
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

    let discountAmount = 0;
    if (
      input.body.discountAmount !== undefined &&
      input.body.discountAmount !== null
    ) {
      discountAmount =
        parseDecimal(input.body.discountAmount, "discountAmount") ?? 0;
      if (discountAmount < 0) {
        throw new AppError(
          "ERR_VALIDATION_ERROR",
          400,
          "discountAmount inválido."
        );
      }
    }

    const totalAmount = computeLineTotal(unitPrice, quantity, discountAmount);

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
        discountAmount: roundMoney(discountAmount),
        totalAmount,
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
