import { Op, col, where as sequelizeWhere } from "sequelize";
import InventoryCategory from "../../models/InventoryCategory";
import InventoryProduct from "../../models/InventoryProduct";

/** Produtos ativos com estoque baixo (abaixo ou igual ao mínimo). */
export default async function ListInventoryLowStockProductsService(
  companyId: number
): Promise<InventoryProduct[]> {
  return InventoryProduct.findAll({
    where: {
      companyId,
      active: true,
      trackStock: true,
      minStock: { [Op.ne]: null },
      [Op.and]: [
        sequelizeWhere(col("currentQuantity"), "<=", col("minStock"))
      ]
    } as any,
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
