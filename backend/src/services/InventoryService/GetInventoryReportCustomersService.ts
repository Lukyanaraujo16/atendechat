import { Op, fn, col, literal } from "sequelize";
import InventorySale from "../../models/InventorySale";
import Contact from "../../models/Contact";
import {
  buildReportCompletedWhere,
  InventoryReportFilters,
  roundReportMoney,
  toReportNumber
} from "./inventoryReportHelpers";

export type CustomerReportRow = {
  contactId: number;
  contactName: string | null;
  salesCount: number;
  totalSold: number;
  lastPurchaseAt: Date | null;
};

export default async function GetInventoryReportCustomersService(
  input: InventoryReportFilters
): Promise<CustomerReportRow[]> {
  const where = {
    ...buildReportCompletedWhere(input),
    contactId: { [Op.ne]: null }
  };

  const rows = (await InventorySale.findAll({
    where,
    attributes: [
      "contactId",
      [fn("COUNT", col("id")), "salesCount"],
      [fn("COALESCE", fn("SUM", col("totalAmount")), 0), "totalSold"],
      [fn("MAX", col("completedAt")), "lastPurchaseAt"]
    ],
    group: ["contactId"],
    order: [[literal("totalSold"), "DESC"]],
    raw: true
  })) as unknown as Array<Record<string, unknown>>;

  const contactIds = rows
    .map((r) => r.contactId)
    .filter((id): id is number => id != null && Number.isFinite(Number(id)))
    .map((id) => Number(id));

  const contacts =
    contactIds.length > 0
      ? await Contact.findAll({
          where: { companyId: input.companyId, id: contactIds },
          attributes: ["id", "name"]
        })
      : [];

  const contactMap = new Map(contacts.map((c) => [c.id, c.name]));

  return rows.map((row) => {
    const contactId = Number(row.contactId);
    const last = row.lastPurchaseAt;
    return {
      contactId,
      contactName: contactMap.get(contactId) || null,
      salesCount: toReportNumber(row.salesCount),
      totalSold: roundReportMoney(toReportNumber(row.totalSold)),
      lastPurchaseAt:
        last instanceof Date
          ? last
          : last
            ? new Date(String(last))
            : null
    };
  });
}
