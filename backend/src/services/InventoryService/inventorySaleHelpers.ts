import { FindOptions, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import InventorySale, { InventorySaleStatus } from "../../models/InventorySale";
import InventorySaleItem from "../../models/InventorySaleItem";
import InventoryProduct from "../../models/InventoryProduct";
import { buildInventorySaleItemIdentifierInclude } from "./inventorySaleItemIdentifiers";

export function buildInventorySaleIncludes(companyId: number) {
  return [
    {
      model: Contact,
      attributes: ["id", "name", "number"],
      required: false
    },
    {
      model: Ticket,
      attributes: ["id", "status", "contactId"],
      required: false
    },
    {
      model: User,
      as: "seller",
      attributes: ["id", "name", "email"],
      required: false
    },
    {
      model: User,
      as: "creator",
      attributes: ["id", "name"],
      required: false
    },
    {
      model: User,
      as: "canceller",
      attributes: ["id", "name"],
      required: false
    },
    {
      model: InventorySaleItem,
      as: "items",
      required: false,
      include: [
        {
          model: InventoryProduct,
          attributes: ["id", "name", "sku", "active"],
          required: false
        },
        buildInventorySaleItemIdentifierInclude(companyId)
      ]
    }
  ];
}

export function cloneInventorySaleIncludes(companyId: number) {
  return buildInventorySaleIncludes(companyId);
}

/** Includes passam a ser construídos por request; não há filtro partilhado a limpar. */
export function resetInventorySaleIncludesContactFilter(): void {
  return undefined;
}

export function toMoney(value: string | number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeLineTotal(
  unitPrice: number,
  quantity: number,
  discountAmount: number
): number {
  return roundMoney(unitPrice * quantity - discountAmount);
}

export async function findInventorySaleOrThrow(
  companyId: number,
  id: number,
  transaction?: Transaction,
  lock?: FindOptions["lock"]
): Promise<InventorySale> {
  const options: FindOptions = {
    where: { id, companyId },
    transaction
  };
  if (lock) {
    options.lock = lock;
  }
  const sale = await InventorySale.findOne(options);
  if (!sale) {
    throw new AppError("ERR_INVENTORY_SALE_NOT_FOUND", 404);
  }
  return sale;
}

export function assertInventorySaleIsDraft(
  sale: InventorySale,
  action: string
): void {
  if (sale.status !== "draft") {
    throw new AppError(
      "ERR_INVENTORY_SALE_NOT_DRAFT",
      400,
      `Somente vendas em rascunho podem ${action}.`
    );
  }
}

export async function assertInventoryUserInCompany(
  companyId: number,
  userId: number | null | undefined,
  field: string
): Promise<void> {
  if (userId == null) return;
  const user = await User.findOne({ where: { id: userId, companyId } });
  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404, `${field} inválido.`);
  }
}

export async function validateInventorySaleLinks(input: {
  companyId: number;
  contactId?: number | null;
  ticketId?: number | null;
  sellerUserId?: number | null;
}): Promise<void> {
  const { companyId, contactId, ticketId, sellerUserId } = input;

  if (contactId != null) {
    const contact = await Contact.findOne({ where: { id: contactId, companyId } });
    if (!contact) {
      throw new AppError("ERR_NO_CONTACT_FOUND", 404);
    }
  }

  if (ticketId != null) {
    const ticket = await Ticket.findOne({ where: { id: ticketId, companyId } });
    if (!ticket) {
      throw new AppError("ERR_NO_TICKET_FOUND", 404);
    }
    if (contactId != null && ticket.contactId !== contactId) {
      throw new AppError("ERR_TICKET_CONTACT_MISMATCH", 400);
    }
  }

  await assertInventoryUserInCompany(companyId, sellerUserId, "sellerUserId");
}

export async function recalculateInventorySaleTotals(
  saleId: number,
  companyId: number,
  transaction?: Transaction
): Promise<void> {
  const items = await InventorySaleItem.findAll({
    where: { saleId, companyId },
    transaction
  });

  let subtotalAmount = 0;
  let discountAmount = 0;
  let totalAmount = 0;

  for (const item of items) {
    const unitPrice = toMoney(item.unitPrice);
    const qty = Number(item.quantity);
    const lineDiscount = toMoney(item.discountAmount);
    const lineSubtotal = roundMoney(unitPrice * qty);
    const lineTotal = computeLineTotal(unitPrice, qty, lineDiscount);

    subtotalAmount += lineSubtotal;
    discountAmount += lineDiscount;
    totalAmount += lineTotal;

    if (toMoney(item.totalAmount) !== lineTotal) {
      await item.update({ totalAmount: lineTotal }, { transaction });
    }
  }

  await InventorySale.update(
    {
      subtotalAmount: roundMoney(subtotalAmount),
      discountAmount: roundMoney(discountAmount),
      totalAmount: roundMoney(totalAmount)
    },
    { where: { id: saleId, companyId }, transaction }
  );
}

export function parseOptionalId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return n;
}

export function assertSaleStatus(
  sale: InventorySale,
  allowed: InventorySaleStatus[],
  message: string
): void {
  if (!allowed.includes(sale.status)) {
    throw new AppError("ERR_INVENTORY_SALE_INVALID_STATUS", 400, message);
  }
}

export async function loadActiveInventoryProductOrThrow(
  companyId: number,
  productId: number,
  transaction?: Transaction
): Promise<InventoryProduct> {
  const product = await InventoryProduct.findOne({
    where: { id: productId, companyId },
    transaction
  });
  if (!product) {
    throw new AppError("ERR_INVENTORY_PRODUCT_NOT_FOUND", 404);
  }
  if (!product.active) {
    throw new AppError(
      "ERR_INVENTORY_PRODUCT_INACTIVE",
      400,
      "Produto inativo não pode ser vendido."
    );
  }
  return product;
}

export function buildProductSnapshot(product: InventoryProduct) {
  return {
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    unit: product.unit,
    unitPrice: toMoney(product.salePrice),
    costPrice: product.costPrice != null ? toMoney(product.costPrice) : null,
    trackStock: product.trackStock === true
  };
}
