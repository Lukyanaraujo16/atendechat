import InventorySale from "../../models/InventorySale";
import {
  buildInventorySaleIncludes,
  findInventorySaleOrThrow
} from "./inventorySaleHelpers";

export default async function ShowInventorySaleService(input: {
  companyId: number;
  id: number;
}): Promise<InventorySale> {
  const sale = await findInventorySaleOrThrow(input.companyId, input.id);
  return sale.reload({ include: buildInventorySaleIncludes(input.companyId) });
}
