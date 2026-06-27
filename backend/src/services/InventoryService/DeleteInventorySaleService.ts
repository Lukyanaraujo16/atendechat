import InventorySale from "../../models/InventorySale";
import {
  assertInventorySaleIsDraft,
  findInventorySaleOrThrow
} from "./inventorySaleHelpers";

/** Remove venda em rascunho e itens (cascade). */
export default async function DeleteInventorySaleService(input: {
  companyId: number;
  id: number;
}): Promise<void> {
  const sale = await findInventorySaleOrThrow(input.companyId, input.id);
  assertInventorySaleIsDraft(sale, "ser excluída");
  await sale.destroy();
}
