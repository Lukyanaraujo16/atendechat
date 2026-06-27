import ListInventoryStockMovementsService from "./ListInventoryStockMovementsService";
import { findInventoryProductOrThrow } from "./inventoryTenant";

export default async function ListInventoryProductStockMovementsService(input: {
  companyId: number;
  productId: number;
  type?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  page?: unknown;
  limit?: unknown;
}) {
  await findInventoryProductOrThrow(input.companyId, input.productId);
  return ListInventoryStockMovementsService({
    companyId: input.companyId,
    productId: input.productId,
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    page: input.page,
    limit: input.limit
  });
}
