import { getCustomerCreditSnapshot } from "./inventoryCustomerCredit";

export default async function GetInventoryCustomerCreditSummaryService(input: {
  companyId: number;
  customerId: number;
}) {
  return getCustomerCreditSnapshot(input.companyId, input.customerId);
}
