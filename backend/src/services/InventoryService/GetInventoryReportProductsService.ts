import { fn, col, literal } from "sequelize";
import InventorySale from "../../models/InventorySale";
import InventorySaleItem from "../../models/InventorySaleItem";
import {
  buildReportCompletedWhere,
  InventoryReportFilters,
  roundReportMoney,
  toReportNumber
} from "./inventoryReportHelpers";

export type ProductReportRow = {
  productId: number;
  productName: string;
  productSku: string | null;
  quantitySold: number;
  totalSold: number;
  salesCount: number;
};

export default async function GetInventoryReportProductsService(
  input: InventoryReportFilters
): Promise<ProductReportRow[]> {
  const saleWhere = buildReportCompletedWhere(input);

  const rows = (await InventorySaleItem.findAll({
    where: { companyId: input.companyId },
    attributes: [
      "productId",
      "productName",
      "productSku",
      [fn("SUM", col("quantity")), "quantitySold"],
      [
        fn("COALESCE", fn("SUM", col("InventorySaleItem.totalAmount")), 0),
        "totalSold"
      ],
      [fn("COUNT", fn("DISTINCT", col("saleId"))), "salesCount"]
    ],
    include: [
      {
        model: InventorySale,
        as: "sale",
        attributes: [],
        where: saleWhere,
        required: true
      }
    ],
    group: ["productId", "productName", "productSku"],
    order: [[literal('"totalSold"'), "DESC"]],
    raw: true
  })) as unknown as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    productId: Number(row.productId),
    productName: String(row.productName || ""),
    productSku: row.productSku != null ? String(row.productSku) : null,
    quantitySold: toReportNumber(row.quantitySold),
    totalSold: roundReportMoney(toReportNumber(row.totalSold)),
    salesCount: toReportNumber(row.salesCount)
  }));
}
