import sequelize from "../../database";
import AppError from "../../errors/AppError";
import InventorySale from "../../models/InventorySale";
import InventoryCustomer from "../../models/InventoryCustomer";
import {
  buildInventorySaleIncludes,
  parseOptionalId,
  validateInventorySaleLinks
} from "./inventorySaleHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

type CreateBody = {
  contactId?: unknown;
  customerId?: unknown;
  ticketId?: unknown;
  sellerUserId?: unknown;
  notes?: unknown;
  source?: unknown;
};

const ALLOWED_SOURCES = new Set(["manual", "ticket", "whatsapp"]);

export default async function CreateInventorySaleService(input: {
  companyId: number;
  createdBy: number | null;
  body: CreateBody;
}): Promise<InventorySale> {
  let contactId = parseOptionalId(input.body.contactId);
  const customerId = parseOptionalId(input.body.customerId);
  const ticketId = parseOptionalId(input.body.ticketId);
  const sellerUserId = parseOptionalId(input.body.sellerUserId);

  if (customerId != null) {
    const customer = await InventoryCustomer.findOne({
      where: { id: customerId, companyId: input.companyId }
    });
    if (!customer) {
      throw new AppError("ERR_INVENTORY_CUSTOMER_NOT_FOUND", 404);
    }
    if (contactId == null && customer.contactId != null) {
      contactId = customer.contactId;
    }
  }

  await validateInventorySaleLinks({
    companyId: input.companyId,
    contactId,
    ticketId,
    sellerUserId
  });

  let source = "manual";
  if (input.body.source !== undefined && input.body.source !== null) {
    const s = String(input.body.source).trim();
    if (!ALLOWED_SOURCES.has(s)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "source inválido.");
    }
    source = s;
  }

  const notes = normalizeOptionalString(input.body.notes);

  return sequelize.transaction(async t => {
    const sale = await InventorySale.create(
      {
        companyId: input.companyId,
        saleNumber: 0,
        status: "draft",
        source: source as InventorySale["source"],
        contactId,
        customerId,
        ticketId,
        sellerUserId,
        notes,
        createdBy: input.createdBy,
        subtotalAmount: 0,
        discountAmount: 0,
        totalAmount: 0
      },
      { transaction: t }
    );

    await sale.update({ saleNumber: -sale.id }, { transaction: t });

    return sale.reload({
      transaction: t,
      include: buildInventorySaleIncludes(input.companyId)
    });
  });
}
