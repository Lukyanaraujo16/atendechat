import { Op, fn, col, literal } from "sequelize";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryCustomer from "../../models/InventoryCustomer";
import {
  InventoryReportFilters,
  roundReportMoney,
  toReportNumber
} from "./inventoryReportHelpers";
import { parseOptionalDateQuery } from "./inventoryTenant";

export type StoreCreditReportRow = {
  customerId: number;
  customerName: string | null;
  receivablesCount: number;
  originatedAmount: number;
  openAmount: number;
};

export default async function GetInventoryReportStoreCreditService(
  input: InventoryReportFilters
): Promise<StoreCreditReportRow[]> {
  const start = parseOptionalDateQuery(input.startDate);
  const end = parseOptionalDateQuery(input.endDate);

  const where: any = {
    companyId: input.companyId,
    originType: "store_credit",
    status: { [Op.ne]: "cancelled" }
  };
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt[Op.gte] = start;
    if (end) where.createdAt[Op.lte] = end;
  }

  const rows = (await InventoryReceivable.findAll({
    where,
    attributes: [
      "customerId",
      [fn("COUNT", col("InventoryReceivable.id")), "receivablesCount"],
      [
        fn("COALESCE", fn("SUM", col("InventoryReceivable.originalAmount")), 0),
        "originatedAmount"
      ],
      [
        fn("COALESCE", fn("SUM", col("InventoryReceivable.openAmount")), 0),
        "openAmount"
      ]
    ],
    include: [
      {
        model: InventoryCustomer,
        attributes: ["id", "name"],
        required: true
      }
    ],
    group: ["InventoryReceivable.customerId", "customer.id", "customer.name"],
    order: [[literal('"originatedAmount"'), "DESC"]],
    raw: true,
    nest: true
  })) as unknown as Array<Record<string, unknown>>;

  return rows.map(row => ({
    customerId: Number(row.customerId),
    customerName:
      (row as any).customer?.name ??
      (row as any)["customer.name"] ??
      null,
    receivablesCount: toReportNumber(row.receivablesCount),
    originatedAmount: roundReportMoney(toReportNumber(row.originatedAmount)),
    openAmount: roundReportMoney(toReportNumber(row.openAmount))
  }));
}
