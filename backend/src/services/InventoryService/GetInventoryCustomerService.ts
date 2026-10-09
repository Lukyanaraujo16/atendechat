import AppError from "../../errors/AppError";
import InventoryCustomer from "../../models/InventoryCustomer";
import Contact from "../../models/Contact";
import {
  customerToJSON
} from "./inventoryCustomerHelpers";
import { getCustomerCreditSnapshot } from "./inventoryCustomerCredit";

export default async function GetInventoryCustomerService(input: {
  companyId: number;
  customerId: number;
  includeFinancials?: boolean;
}): Promise<Record<string, unknown>> {
  const customer = await InventoryCustomer.findOne({
    where: { id: input.customerId, companyId: input.companyId },
    include: [
      {
        model: Contact,
        attributes: ["id", "name", "number"],
        required: false
      }
    ]
  });
  if (!customer) {
    throw new AppError("ERR_INVENTORY_CUSTOMER_NOT_FOUND", 404);
  }

  const includeFinancials = input.includeFinancials === true;
  const base = customerToJSON(customer, {
    includeCreditLimit: includeFinancials
  }) as Record<string, unknown>;
  base.contact = customer.contact
    ? {
        id: customer.contact.id,
        name: customer.contact.name,
        number: customer.contact.number
      }
    : null;

  if (includeFinancials) {
    const credit = await getCustomerCreditSnapshot(
      input.companyId,
      customer.id
    );
    base.credit = credit;
  }

  return base;
}
