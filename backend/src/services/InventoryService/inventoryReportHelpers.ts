import { Op } from "sequelize";
import { parseOptionalDateQuery } from "./inventoryTenant";
import { parseOptionalId } from "./inventorySaleHelpers";

export type InventoryReportFilters = {
  companyId: number;
  startDate?: unknown;
  endDate?: unknown;
  sellerUserId?: unknown;
};

export function toReportNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function roundReportMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildReportCompletedWhere(
  input: InventoryReportFilters
): Record<string, unknown> {
  const where: Record<string, unknown> = {
    companyId: input.companyId,
    status: "completed"
  };

  const startDate = parseOptionalDateQuery(input.startDate);
  const endDate = parseOptionalDateQuery(input.endDate);
  if (startDate || endDate) {
    const completedAt: Record<symbol, Date> = {};
    if (startDate) completedAt[Op.gte] = startDate;
    if (endDate) completedAt[Op.lte] = endDate;
    where.completedAt = completedAt;
  }

  if (
    input.sellerUserId !== undefined &&
    input.sellerUserId !== null &&
    input.sellerUserId !== ""
  ) {
    where.sellerUserId = parseOptionalId(input.sellerUserId);
  }

  return where;
}

export function buildReportCancelledWhere(
  input: InventoryReportFilters
): Record<string, unknown> {
  const where: Record<string, unknown> = {
    companyId: input.companyId,
    status: "cancelled"
  };

  const startDate = parseOptionalDateQuery(input.startDate);
  const endDate = parseOptionalDateQuery(input.endDate);
  if (startDate || endDate) {
    const cancelledAt: Record<symbol, Date> = {};
    if (startDate) cancelledAt[Op.gte] = startDate;
    if (endDate) cancelledAt[Op.lte] = endDate;
    where.cancelledAt = cancelledAt;
  }

  if (
    input.sellerUserId !== undefined &&
    input.sellerUserId !== null &&
    input.sellerUserId !== ""
  ) {
    where.sellerUserId = parseOptionalId(input.sellerUserId);
  }

  return where;
}

export function averageTicket(total: number, count: number): number {
  if (count <= 0) return 0;
  return roundReportMoney(total / count);
}
