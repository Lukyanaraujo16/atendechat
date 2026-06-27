import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import InventorySale from "../../models/InventorySale";
import {
  cloneInventorySaleIncludes,
  parseOptionalId,
  resetInventorySaleIncludesContactFilter
} from "./inventorySaleHelpers";
import { isInventoryPaymentStatus } from "./inventoryPaymentHelpers";
import { parseOptionalDateQuery, parsePaginationQuery } from "./inventoryTenant";

export type ListSalesResult = {
  sales: InventorySale[];
  count: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export default async function ListInventorySalesService(input: {
  companyId: number;
  status?: unknown;
  contactId?: unknown;
  ticketId?: unknown;
  sellerUserId?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  search?: unknown;
  paymentStatus?: unknown;
  page?: unknown;
  limit?: unknown;
}): Promise<ListSalesResult> {
  const { page, limit, offset } = parsePaginationQuery(input.page, input.limit);
  const where: any = { companyId: input.companyId };

  if (input.status !== undefined && input.status !== null && input.status !== "") {
    const status = String(input.status).trim();
    if (!["draft", "completed", "cancelled"].includes(status)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "status inválido.");
    }
    where.status = status;
  }

  if (
    input.paymentStatus !== undefined &&
    input.paymentStatus !== null &&
    input.paymentStatus !== ""
  ) {
    const paymentStatus = String(input.paymentStatus).trim();
    if (!isInventoryPaymentStatus(paymentStatus)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "paymentStatus inválido.");
    }
    where.paymentStatus = paymentStatus;
  }

  if (input.contactId !== undefined && input.contactId !== null && input.contactId !== "") {
    where.contactId = parseOptionalId(input.contactId);
  }
  if (input.ticketId !== undefined && input.ticketId !== null && input.ticketId !== "") {
    where.ticketId = parseOptionalId(input.ticketId);
  }
  if (
    input.sellerUserId !== undefined &&
    input.sellerUserId !== null &&
    input.sellerUserId !== ""
  ) {
    where.sellerUserId = parseOptionalId(input.sellerUserId);
  }

  const startDate = parseOptionalDateQuery(input.startDate);
  const endDate = parseOptionalDateQuery(input.endDate);
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt[Op.gte] = startDate;
    if (endDate) where.createdAt[Op.lte] = endDate;
  }

  resetInventorySaleIncludesContactFilter();

  const search =
    input.search != null && String(input.search).trim() !== ""
      ? String(input.search).trim()
      : "";
  const include = cloneInventorySaleIncludes();
  if (search) {
    const or: any[] = [
      { notes: { [Op.like]: `%${search}%` } },
      { "$contact.name$": { [Op.like]: `%${search}%` } }
    ];
    const asNum = Number(search);
    if (Number.isFinite(asNum)) {
      or.push({ saleNumber: asNum });
    }
    where[Op.or] = or;
  }

  const { count, rows } = await InventorySale.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    include,
    distinct: true,
    ...(search ? { subQuery: false } : {})
  });

  return {
    sales: rows,
    count,
    page,
    limit,
    hasMore: count > offset + rows.length
  };
}
