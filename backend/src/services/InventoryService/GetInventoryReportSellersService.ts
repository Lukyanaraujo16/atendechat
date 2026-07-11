import { fn, col, literal } from "sequelize";
import InventorySale from "../../models/InventorySale";
import User from "../../models/User";
import {
  averageTicket,
  buildReportCompletedWhere,
  InventoryReportFilters,
  roundReportMoney,
  toReportNumber
} from "./inventoryReportHelpers";

export type SellerReportRow = {
  sellerUserId: number | null;
  sellerName: string | null;
  salesCount: number;
  totalSold: number;
  totalCommission: number;
  averageTicket: number;
};

export default async function GetInventoryReportSellersService(
  input: InventoryReportFilters
): Promise<SellerReportRow[]> {
  const where = buildReportCompletedWhere(input);

  const rows = (await InventorySale.findAll({
    where,
    attributes: [
      "sellerUserId",
      [fn("COUNT", col("id")), "salesCount"],
      [fn("COALESCE", fn("SUM", col("totalAmount")), 0), "totalSold"],
      [fn("COALESCE", fn("SUM", col("commissionAmount")), 0), "totalCommission"]
    ],
    group: ["sellerUserId"],
    order: [[literal('"totalSold"'), "DESC"]],
    raw: true
  })) as unknown as Array<Record<string, unknown>>;

  const sellerIds = rows
    .map((r) => r.sellerUserId)
    .filter((id): id is number => id != null && Number.isFinite(Number(id)))
    .map((id) => Number(id));

  const users =
    sellerIds.length > 0
      ? await User.findAll({
          where: { companyId: input.companyId, id: sellerIds },
          attributes: ["id", "name"]
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((row) => {
    const sellerUserId =
      row.sellerUserId != null ? Number(row.sellerUserId) : null;
    const salesCount = toReportNumber(row.salesCount);
    const totalSold = roundReportMoney(toReportNumber(row.totalSold));
    return {
      sellerUserId,
      sellerName:
        sellerUserId != null
          ? userMap.get(sellerUserId) || null
          : null,
      salesCount,
      totalSold,
      totalCommission: roundReportMoney(toReportNumber(row.totalCommission)),
      averageTicket: averageTicket(totalSold, salesCount)
    };
  });
}
