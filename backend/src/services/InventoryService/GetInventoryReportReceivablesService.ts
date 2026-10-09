import { Op, literal } from "sequelize";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryCustomer from "../../models/InventoryCustomer";
import { todayCivilDate } from "./inventoryReceivableHelpers";
import {
  InventoryReportFilters,
  roundReportMoney,
  toReportNumber
} from "./inventoryReportHelpers";

export type ReceivableReportRow = {
  customerId: number;
  customerName: string | null;
  openAmount: number;
  overdueAmount: number;
  installmentCount: number;
};

export default async function GetInventoryReportReceivablesService(
  input: InventoryReportFilters & { asOfDate?: unknown }
): Promise<ReceivableReportRow[]> {
  const today =
    input.asOfDate != null && String(input.asOfDate).trim()
      ? String(input.asOfDate).trim()
      : todayCivilDate();

  const rows = await InventoryReceivableInstallment.findAll({
    where: {
      companyId: input.companyId,
      status: { [Op.in]: ["open", "partial"] }
    },
    include: [
      {
        model: InventoryReceivable,
        required: true,
        where: { companyId: input.companyId },
        attributes: ["customerId"],
        include: [
          {
            model: InventoryCustomer,
            attributes: ["id", "name"],
            required: true
          }
        ]
      }
    ],
    attributes: [
      [literal('"receivable"."customerId"'), "customerId"],
      [
        literal(
          'COALESCE(SUM("InventoryReceivableInstallment"."openAmount"), 0)'
        ),
        "openAmount"
      ],
      [
        literal(
          `COALESCE(SUM(CASE WHEN "InventoryReceivableInstallment"."dueDate" < '${today}' THEN "InventoryReceivableInstallment"."openAmount" ELSE 0 END), 0)`
        ),
        "overdueAmount"
      ],
      [
        literal('COUNT("InventoryReceivableInstallment"."id")'),
        "installmentCount"
      ]
    ] as any,
    group: [
      "receivable.customerId",
      "receivable->customer.id",
      "receivable->customer.name"
    ],
    order: [[literal('"openAmount"'), "DESC"]],
    raw: true,
    nest: true
  }) as unknown as Array<Record<string, unknown>>;

  return rows.map(row => ({
    customerId: Number(row.customerId),
    customerName:
      (row as any).receivable?.customer?.name ??
      (row as any)["receivable.customer.name"] ??
      null,
    openAmount: roundReportMoney(toReportNumber(row.openAmount)),
    overdueAmount: roundReportMoney(toReportNumber(row.overdueAmount)),
    installmentCount: toReportNumber(row.installmentCount)
  }));
}
