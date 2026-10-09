import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import CreateInventoryCustomerService from "./CreateInventoryCustomerService";
import { InventoryCustomerBody } from "./inventoryCustomerHelpers";
import { normalizePhoneDigits } from "./inventoryDocumentHelpers";

export default async function CreateInventoryCustomerFromContactService(input: {
  companyId: number;
  contactId: number;
  body?: InventoryCustomerBody;
  canManageCredit?: boolean;
}): Promise<ReturnType<typeof CreateInventoryCustomerService>> {
  const contact = await Contact.findOne({
    where: { id: input.contactId, companyId: input.companyId }
  });
  if (!contact) {
    throw new AppError(
      "ERR_INVENTORY_CUSTOMER_CONTACT_NOT_FOUND",
      404,
      "Contact não encontrado nesta empresa."
    );
  }

  const overrides = input.body ?? {};
  return CreateInventoryCustomerService({
    companyId: input.companyId,
    canManageCredit: input.canManageCredit,
    body: {
      type: overrides.type ?? "individual",
      name: overrides.name ?? contact.name,
      phone: overrides.phone ?? normalizePhoneDigits(contact.number),
      email: overrides.email ?? contact.email,
      postalCode: overrides.postalCode ?? contact.postalCode,
      street: overrides.street ?? contact.street,
      addressNumber: overrides.addressNumber ?? contact.addressNumber,
      addressComplement:
        overrides.addressComplement ?? contact.addressComplement,
      district: overrides.district ?? contact.district,
      city: overrides.city ?? contact.city,
      state: overrides.state ?? contact.state,
      document: overrides.document,
      tradeName: overrides.tradeName,
      notes: overrides.notes,
      creditLimit: overrides.creditLimit ?? 0,
      contactId: contact.id,
      isActive: overrides.isActive
    }
  });
}
