import AppError from "../../errors/AppError";
import InventoryCustomer from "../../models/InventoryCustomer";
import { customerToJSON } from "./inventoryCustomerHelpers";

export default async function ActivateInventoryCustomerService(input: {
  companyId: number;
  customerId: number;
}): Promise<ReturnType<typeof customerToJSON>> {
  const customer = await InventoryCustomer.findOne({
    where: { id: input.customerId, companyId: input.companyId }
  });
  if (!customer) {
    throw new AppError("ERR_INVENTORY_CUSTOMER_NOT_FOUND", 404);
  }
  await customer.update({ isActive: true });
  return customerToJSON(await customer.reload());
}
