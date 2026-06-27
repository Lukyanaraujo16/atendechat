import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryStockMovement from "../../models/InventoryStockMovement";
import InventoryProduct from "../../models/InventoryProduct";
import User from "../../models/User";
import {
  isInventoryStockMovementType,
  InventoryStockMovementType
} from "./inventoryStockMovementTypes";
import {
  findInventoryProductOrThrow,
  parseOptionalDateQuery,
  parsePaginationQuery
} from "./inventoryTenant";

const movementIncludes = [
  {
    model: InventoryProduct,
    attributes: ["id", "name", "sku", "unit"],
    required: true
  },
  {
    model: User,
    as: "creator",
    attributes: ["id", "name"],
    required: false
  }
];

export type ListStockMovementsResult = {
  movements: InventoryStockMovement[];
  count: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

export default async function ListInventoryStockMovementsService(input: {
  companyId: number;
  productId?: unknown;
  type?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  page?: unknown;
  limit?: unknown;
}): Promise<ListStockMovementsResult> {
  const { page, limit, offset } = parsePaginationQuery(input.page, input.limit);
  const where: any = { companyId: input.companyId };

  if (
    input.productId !== undefined &&
    input.productId !== null &&
    input.productId !== ""
  ) {
    const productId = Number(input.productId);
    if (!Number.isFinite(productId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "productId inválido.");
    }
    await findInventoryProductOrThrow(input.companyId, productId);
    where.productId = productId;
  }

  if (input.type !== undefined && input.type !== null && input.type !== "") {
    const typeRaw = String(input.type).trim();
    if (!isInventoryStockMovementType(typeRaw)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "Tipo inválido.");
    }
    where.type = typeRaw as InventoryStockMovementType;
  }

  const startDate = parseOptionalDateQuery(input.startDate);
  const endDate = parseOptionalDateQuery(input.endDate);
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt[Op.gte] = startDate;
    }
    if (endDate) {
      where.createdAt[Op.lte] = endDate;
    }
  }

  const { count, rows } = await InventoryStockMovement.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    include: movementIncludes
  });

  return {
    movements: rows,
    count,
    page,
    limit,
    hasMore: count > offset + rows.length
  };
}
