import AppError from "../../errors/AppError";
import InventoryCustomer from "../../models/InventoryCustomer";
import {
  assertContactAvailableForCustomer,
  assertDocumentUniqueForCompany,
  customerToJSON,
  InventoryCustomerBody,
  parseCustomerFields
} from "./inventoryCustomerHelpers";

export default async function UpdateInventoryCustomerService(input: {
  companyId: number;
  customerId: number;
  body: InventoryCustomerBody;
  /** Se false, bloqueia alteração de creditLimit (sem manageCustomerCredit). */
  canManageCredit?: boolean;
}): Promise<ReturnType<typeof customerToJSON>> {
  const customer = await InventoryCustomer.findOne({
    where: { id: input.customerId, companyId: input.companyId }
  });
  if (!customer) {
    throw new AppError("ERR_INVENTORY_CUSTOMER_NOT_FOUND", 404);
  }

  const fields = parseCustomerFields(input.body, {
    existingType: customer.type
  });

  if (
    fields.creditLimit !== undefined &&
    input.canManageCredit === false
  ) {
    throw new AppError(
      "ERR_NO_PERMISSION",
      403,
      "Sem permissão para alterar limite de crédito."
    );
  }

  if (fields.document !== undefined) {
    await assertDocumentUniqueForCompany({
      companyId: input.companyId,
      document: fields.document as string | null,
      excludeCustomerId: customer.id
    });
  }
  if (fields.contactId !== undefined) {
    await assertContactAvailableForCustomer({
      companyId: input.companyId,
      contactId: fields.contactId as number | null,
      excludeCustomerId: customer.id
    });
  }

  if (Object.keys(fields).length === 0) {
    return customerToJSON(customer);
  }

  await customer.update(fields);
  return customerToJSON(await customer.reload());
}
