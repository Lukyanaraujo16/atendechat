import { Op, col, where as sequelizeWhere } from "sequelize";
import InventoryCategory from "../../models/InventoryCategory";
import InventoryProduct from "../../models/InventoryProduct";
import { parseBooleanQuery } from "./inventoryTenant";

export default async function ListInventoryProductsService(input: {
  companyId: number;
  search?: unknown;
  categoryId?: unknown;
  active?: unknown;
  lowStock?: unknown;
}): Promise<InventoryProduct[]> {
  const where: any = { companyId: input.companyId };

  const active = parseBooleanQuery(input.active);
  if (active !== undefined) {
    where.active = active;
  }

  if (
    input.categoryId !== undefined &&
    input.categoryId !== null &&
    input.categoryId !== ""
  ) {
    const categoryId = Number(input.categoryId);
    if (!Number.isFinite(categoryId)) {
      where.categoryId = -1;
    } else {
      where.categoryId = categoryId;
    }
  }

  const search =
    input.search != null && String(input.search).trim() !== ""
      ? String(input.search).trim()
      : "";
  if (search) {
    const term = `%${search}%`;
    where[Op.or] = [
      { name: { [Op.like]: term } },
      { sku: { [Op.like]: term } },
      { barcode: { [Op.like]: term } }
    ];
  }

  const lowStock = parseBooleanQuery(input.lowStock);
  const andClauses: any[] = [];
  if (lowStock === true) {
    andClauses.push({ minStock: { [Op.ne]: null } });
    andClauses.push(
      sequelizeWhere(col("currentQuantity"), "<=", col("minStock"))
    );
  }
  if (andClauses.length) {
    where[Op.and] = andClauses;
  }

  return InventoryProduct.findAll({
    where,
    order: [
      ["name", "ASC"],
      ["id", "ASC"]
    ],
    include: [
      {
        model: InventoryCategory,
        attributes: ["id", "name"],
        required: false
      }
    ]
  });
}
