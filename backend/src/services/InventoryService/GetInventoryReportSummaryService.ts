import { fn, col, literal } from "sequelize";
import InventorySale from "../../models/InventorySale";
import {
  averageTicket,
  buildReportCancelledWhere,
  buildReportCompletedWhere,
  InventoryReportFilters,
  roundReportMoney,
  toReportNumber
} from "./inventoryReportHelpers";

export type InventoryReportSummary = {
  totalSold: number;
  completedSalesCount: number;
  averageTicket: number;
  totalCommission: number;
  cancelledSalesCount: number;
  cancelledTotal: number;
  totalPaid: number;
  totalPending: number;
};

export default async function GetInventoryReportSummaryService(
  input: InventoryReportFilters
): Promise<InventoryReportSummary> {
  const completedWhere = buildReportCompletedWhere(input);
  const cancelledWhere = buildReportCancelledWhere(input);

  const completedRow = (await InventorySale.findOne({
    where: completedWhere,
    attributes: [
      [fn("COUNT", col("id")), "salesCount"],
      [fn("COALESCE", fn("SUM", col("totalAmount")), 0), "totalSold"],
      [fn("COALESCE", fn("SUM", col("commissionAmount")), 0), "totalCommission"],
      [
        fn(
          "COALESCE",
          fn(
            "SUM",
            literal(
              "CASE WHEN \"paymentStatus\" IN ('paid', 'partial') THEN \"paidAmount\" ELSE 0 END"
            )
          ),
          0
        ),
        "totalPaid"
      ],
      [
        fn(
          "COALESCE",
          fn(
            "SUM",
            literal(
              "CASE WHEN \"paymentStatus\" IN ('unpaid', 'partial') THEN (\"totalAmount\" - \"paidAmount\") ELSE 0 END"
            )
          ),
          0
        ),
        "totalPending"
      ]
    ],
    raw: true
  })) as unknown as Record<string, unknown> | null;

  const cancelledRow = (await InventorySale.findOne({
    where: cancelledWhere,
    attributes: [
      [fn("COUNT", col("id")), "salesCount"],
      [fn("COALESCE", fn("SUM", col("totalAmount")), 0), "totalSold"]
    ],
    raw: true
  })) as unknown as Record<string, unknown> | null;

  const completedCount = toReportNumber(completedRow?.salesCount);
  const totalSold = roundReportMoney(toReportNumber(completedRow?.totalSold));

  return {
    totalSold,
    completedSalesCount: completedCount,
    averageTicket: averageTicket(totalSold, completedCount),
    totalCommission: roundReportMoney(
      toReportNumber(completedRow?.totalCommission)
    ),
    cancelledSalesCount: toReportNumber(cancelledRow?.salesCount),
    cancelledTotal: roundReportMoney(toReportNumber(cancelledRow?.totalSold)),
    totalPaid: roundReportMoney(toReportNumber(completedRow?.totalPaid)),
    totalPending: roundReportMoney(toReportNumber(completedRow?.totalPending))
  };
}
