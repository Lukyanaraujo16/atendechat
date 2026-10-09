import InventoryCustomer from "../../models/InventoryCustomer";
import {
  assertContactAvailableForCustomer,
  assertDocumentUniqueForCompany,
  customerToJSON,
  InventoryCustomerBody,
  parseCustomerFields
} from "./inventoryCustomerHelpers";

export default async function CreateInventoryCustomerService(input: {
  companyId: number;
  body: InventoryCustomerBody;
  /** Se false, creditLimit é forçado a 0 (default seguro). */
  canManageCredit?: boolean;
}): Promise<ReturnType<typeof customerToJSON>> {
  const fields = parseCustomerFields(input.body, { requireName: true });

  await assertDocumentUniqueForCompany({
    companyId: input.companyId,
    document: (fields.document as string | null) ?? null
  });
  await assertContactAvailableForCustomer({
    companyId: input.companyId,
    contactId: (fields.contactId as number | null) ?? null
  });

  // Sem manageCustomerCredit: criação cadastral ok, limite permanece 0.
  const creditLimit =
    input.canManageCredit === true ? fields.creditLimit ?? 0 : 0;

  const customer = await InventoryCustomer.create({
    companyId: input.companyId,
    type: fields.type ?? "individual",
    name: fields.name!,
    tradeName: fields.tradeName ?? null,
    document: fields.document ?? null,
    phone: fields.phone ?? null,
    email: fields.email ?? null,
    postalCode: fields.postalCode ?? null,
    street: fields.street ?? null,
    addressNumber: fields.addressNumber ?? null,
    addressComplement: fields.addressComplement ?? null,
    district: fields.district ?? null,
    city: fields.city ?? null,
    state: fields.state ?? null,
    notes: fields.notes ?? null,
    creditLimit,
    contactId: fields.contactId ?? null,
    isActive: fields.isActive !== undefined ? fields.isActive : true
  });

  return customerToJSON(customer);
}
