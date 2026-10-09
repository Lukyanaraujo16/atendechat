import AppError from "../../errors/AppError";
import InventorySale from "../../models/InventorySale";
import InventoryCustomer from "../../models/InventoryCustomer";
import {
  assertInventorySaleIsDraft,
  buildInventorySaleIncludes,
  findInventorySaleOrThrow,
  parseOptionalId,
  validateInventorySaleLinks
} from "./inventorySaleHelpers";
import { normalizeOptionalString } from "./inventoryTenant";

type UpdateBody = {
  contactId?: unknown;
  customerId?: unknown;
  ticketId?: unknown;
  sellerUserId?: unknown;
  notes?: unknown;
  source?: unknown;
};

const ALLOWED_SOURCES = new Set(["manual", "ticket", "whatsapp"]);

export default async function UpdateInventorySaleService(input: {
  companyId: number;
  id: number;
  body: UpdateBody;
}): Promise<InventorySale> {
  const sale = await findInventorySaleOrThrow(input.companyId, input.id);
  assertInventorySaleIsDraft(sale, "ser editada");

  const patch: Partial<InventorySale> = {};

  let contactId = sale.contactId;
  let customerId = sale.customerId;
  let ticketId = sale.ticketId;
  let sellerUserId = sale.sellerUserId;

  if (input.body.customerId !== undefined) {
    customerId = parseOptionalId(input.body.customerId);
    patch.customerId = customerId;
    if (customerId != null) {
      const customer = await InventoryCustomer.findOne({
        where: { id: customerId, companyId: input.companyId }
      });
      if (!customer) {
        throw new AppError("ERR_INVENTORY_CUSTOMER_NOT_FOUND", 404);
      }
      if (
        input.body.contactId === undefined &&
        customer.contactId != null &&
        contactId == null
      ) {
        contactId = customer.contactId;
        patch.contactId = contactId;
      }
    }
  }
  if (input.body.contactId !== undefined) {
    contactId = parseOptionalId(input.body.contactId);
    patch.contactId = contactId;
  }
  if (input.body.ticketId !== undefined) {
    ticketId = parseOptionalId(input.body.ticketId);
    patch.ticketId = ticketId;
  }
  if (input.body.sellerUserId !== undefined) {
    sellerUserId = parseOptionalId(input.body.sellerUserId);
    patch.sellerUserId = sellerUserId;
  }

  await validateInventorySaleLinks({
    companyId: input.companyId,
    contactId,
    ticketId,
    sellerUserId
  });

  if (input.body.notes !== undefined) {
    patch.notes = normalizeOptionalString(input.body.notes);
  }

  if (input.body.source !== undefined) {
    const s = String(input.body.source).trim();
    if (!ALLOWED_SOURCES.has(s)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "source inválido.");
    }
    patch.source = s as InventorySale["source"];
  }

  if (Object.keys(patch).length === 0) {
    return sale.reload({
      include: buildInventorySaleIncludes(input.companyId)
    });
  }

  await sale.update(patch);
  return sale.reload({
    include: buildInventorySaleIncludes(input.companyId)
  });
}
