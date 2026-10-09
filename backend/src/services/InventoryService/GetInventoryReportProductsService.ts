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
  variantId?: number | null;
  variantLabel?: string | null;
  quantitySold: number;
  totalSold: number;
  salesCount: number;
};

export default async function GetInventoryReportProductsService(
  input: InventoryReportFilters & { groupByVariant?: unknown }
): Promise<ProductReportRow[]> {
  const saleWhere = buildReportCompletedWhere(input);
  const byVariant =
    input.groupByVariant === true ||
    input.groupByVariant === "true" ||
    input.groupByVariant === 1 ||
    input.groupByVariant === "1";

  const group = byVariant
    ? ["productId", "productName", "productSku", "variantId", "variantLabel"]
    : ["productId", "productName", "productSku"];

  const attributes: any[] = [
    "productId",
    "productName",
    "productSku",
    [fn("SUM", col("quantity")), "quantitySold"],
    [
      fn("COALESCE", fn("SUM", col("InventorySaleItem.totalAmount")), 0),
      "totalSold"
    ],
    [fn("COUNT", fn("DISTINCT", col("saleId"))), "salesCount"]
  ];
  if (byVariant) {
    attributes.push("variantId", "variantLabel");
  }

  const rows = (await InventorySaleItem.findAll({
    where: { companyId: input.companyId },
    attributes,
    include: [
      {
        model: InventorySale,
        as: "sale",
        attributes: [],
        where: saleWhere,
        required: true
      }
    ],
    group,
    order: [[literal('"totalSold"'), "DESC"]],
    raw: true
  })) as unknown as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    productId: Number(row.productId),
    productName: String(row.productName || ""),
    productSku: row.productSku != null ? String(row.productSku) : null,
    variantId:
      byVariant && row.variantId != null ? Number(row.variantId) : null,
    variantLabel:
      byVariant && row.variantLabel != null
        ? String(row.variantLabel)
        : null,
    quantitySold: toReportNumber(row.quantitySold),
    totalSold: roundReportMoney(toReportNumber(row.totalSold)),
    salesCount: toReportNumber(row.salesCount)
  }));
}
