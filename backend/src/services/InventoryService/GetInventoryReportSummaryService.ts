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
  /** Receita líquida (totalAmount já inclui descontos de item + global + frete). */
  totalSold: number;
  completedSalesCount: number;
  /** Ticket médio sobre receita líquida (totalSold / vendas concluídas). */
  averageTicket: number;
  totalCommission: number;
  /** Soma dos descontos de itens (campo discountAmount da venda = soma das linhas). */
  totalItemDiscounts: number;
  totalGlobalDiscounts: number;
  totalDiscountsGranted: number;
  cancelledSalesCount: number;
  cancelledTotal: number;
  totalPaid: number;
  totalPending: number;
};

/**
 * Resumo de vendas concluídas no período.
 * totalSold, averageTicket, totalPaid e totalPending permanecem em receita líquida (NET),
 * alinhados ao totalAmount autoritativo da venda — não usar bruto de mercadoria aqui.
 */
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
      [fn("COALESCE", fn("SUM", col("discountAmount")), 0), "totalItemDiscounts"],
      [
        fn("COALESCE", fn("SUM", col("globalDiscountAmount")), 0),
        "totalGlobalDiscounts"
      ],
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
  const totalItemDiscounts = roundReportMoney(
    toReportNumber(completedRow?.totalItemDiscounts)
  );
  const totalGlobalDiscounts = roundReportMoney(
    toReportNumber(completedRow?.totalGlobalDiscounts)
  );
  const totalDiscountsGranted = roundReportMoney(
    totalItemDiscounts + totalGlobalDiscounts
  );

  return {
    totalSold,
    completedSalesCount: completedCount,
    averageTicket: averageTicket(totalSold, completedCount),
    totalCommission: roundReportMoney(
      toReportNumber(completedRow?.totalCommission)
    ),
    totalItemDiscounts,
    totalGlobalDiscounts,
    totalDiscountsGranted,
    cancelledSalesCount: toReportNumber(cancelledRow?.salesCount),
    cancelledTotal: roundReportMoney(toReportNumber(cancelledRow?.totalSold)),
    totalPaid: roundReportMoney(toReportNumber(completedRow?.totalPaid)),
    totalPending: roundReportMoney(toReportNumber(completedRow?.totalPending))
  };
}
