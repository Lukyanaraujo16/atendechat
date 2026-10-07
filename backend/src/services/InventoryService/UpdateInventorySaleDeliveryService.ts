import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventoryDeliveryMethod from "../../models/InventoryDeliveryMethod";
import InventorySale from "../../models/InventorySale";
import InventorySaleDelivery from "../../models/InventorySaleDelivery";
import {
  assertAddressRequiredWhenNeeded,
  normalizeSaleDeliveryAddress,
  resolveFreightAmount,
  SaleDeliveryAddressInput
} from "./inventoryDeliveryHelpers";
import {
  assertInventorySaleIsDraft,
  buildInventorySaleIncludes,
  findInventorySaleOrThrow,
  recalculateInventorySaleTotals,
  toMoney
} from "./inventorySaleHelpers";

type DeliveryBody = {
  deliveryMethodId?: unknown;
  freightAmount?: unknown;
  recipient?: SaleDeliveryAddressInput;
  /** Campos flat também aceitos (além de recipient.*). */
  recipientName?: unknown;
  recipientPhone?: unknown;
  postalCode?: unknown;
  street?: unknown;
  number?: unknown;
  complement?: unknown;
  district?: unknown;
  city?: unknown;
  state?: unknown;
  notes?: unknown;
};

function parseMethodId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "deliveryMethodId inválido."
    );
  }
  return id;
}

function extractAddressInput(body: DeliveryBody): SaleDeliveryAddressInput {
  const nested = body.recipient || {};
  return {
    recipientName: nested.recipientName ?? body.recipientName,
    recipientPhone: nested.recipientPhone ?? body.recipientPhone,
    postalCode: nested.postalCode ?? body.postalCode,
    street: nested.street ?? body.street,
    number: nested.number ?? body.number,
    complement: nested.complement ?? body.complement,
    district: nested.district ?? body.district,
    city: nested.city ?? body.city,
    state: nested.state ?? body.state,
    notes: nested.notes ?? body.notes
  };
}

/**
 * Draft: paymentStatus permanece unpaid / paidAmount 0 na config normal.
 * Se houver estado draft excepcional com paidAmount > 0, normaliza para unpaid.
 */
async function normalizeDraftPaymentIfNeeded(
  sale: InventorySale,
  transaction: Transaction
): Promise<void> {
  if (sale.status !== "draft") return;
  const paid = toMoney(sale.paidAmount);
  if (paid !== 0 || sale.paymentStatus !== "unpaid" || sale.paidAt != null) {
    await sale.update(
      {
        paymentStatus: "unpaid",
        paidAmount: 0,
        paidAt: null
      },
      { transaction }
    );
  }
}

export default async function UpdateInventorySaleDeliveryService(input: {
  companyId: number;
  saleId: number;
  body: DeliveryBody;
}): Promise<InventorySale> {
  await sequelize.transaction(async (t: Transaction) => {
    const sale = await findInventorySaleOrThrow(
      input.companyId,
      input.saleId,
      t,
      t.LOCK.UPDATE
    );
    assertInventorySaleIsDraft(sale, "alterar entrega/frete");

    const methodId = parseMethodId(input.body.deliveryMethodId);
    const method = await InventoryDeliveryMethod.findOne({
      where: { id: methodId, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!method) {
      throw new AppError("ERR_INVENTORY_DELIVERY_METHOD_NOT_FOUND", 404);
    }
    if (!method.active) {
      throw new AppError(
        "ERR_INVENTORY_DELIVERY_METHOD_INACTIVE",
        400,
        "Modalidade de entrega inativa."
      );
    }

    const freightAmount = resolveFreightAmount({
      method,
      requestedFreightAmount: input.body.freightAmount
    });

    const address = normalizeSaleDeliveryAddress(
      extractAddressInput(input.body)
    );
    assertAddressRequiredWhenNeeded(method.requiresAddress, address);

    await sale.update(
      {
        freightAmount,
        deliveryMethodId: method.id,
        deliveryMethodName: method.name,
        deliveryKind: method.kind
      },
      { transaction: t }
    );

    const existingDelivery = await InventorySaleDelivery.findOne({
      where: { saleId: sale.id, companyId: input.companyId },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (method.kind === "pickup" || !method.requiresAddress) {
      if (existingDelivery) {
        await existingDelivery.destroy({ transaction: t });
      }
    } else if (existingDelivery) {
      await existingDelivery.update(
        {
          recipientName: address.recipientName,
          recipientPhone: address.recipientPhone,
          postalCode: address.postalCode,
          street: address.street,
          number: address.number,
          complement: address.complement,
          district: address.district,
          city: address.city,
          state: address.state,
          notes: address.notes
        },
        { transaction: t }
      );
    } else {
      await InventorySaleDelivery.create(
        {
          companyId: input.companyId,
          saleId: sale.id,
          recipientName: address.recipientName,
          recipientPhone: address.recipientPhone,
          postalCode: address.postalCode,
          street: address.street,
          number: address.number,
          complement: address.complement,
          district: address.district,
          city: address.city,
          state: address.state,
          notes: address.notes
        },
        { transaction: t }
      );
    }

    await normalizeDraftPaymentIfNeeded(sale, t);
    await recalculateInventorySaleTotals(sale.id, input.companyId, t);
  });

  const updated = await InventorySale.findOne({
    where: { id: input.saleId, companyId: input.companyId }
  });
  if (!updated) {
    throw new AppError("ERR_INVENTORY_SALE_NOT_FOUND", 404);
  }
  return updated.reload({
    include: buildInventorySaleIncludes(input.companyId)
  });
}
