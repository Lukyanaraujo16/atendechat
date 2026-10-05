import {
  Op,
  literal,
  where as sqlWhere,
  UniqueConstraintError
} from "sequelize";
import AppError from "../../errors/AppError";
import InventoryProduct from "../../models/InventoryProduct";
import { INVENTORY_BARCODE_INDEX } from "../../helpers/inventoryBarcodeSchema";

export function inventoryBarcodeWhere(barcode: string) {
  // MySQL/MariaDB: a migration exige utf8mb4_bin na coluna.
  // PostgreSQL: a expressão coincide com o índice, independente da collation default.
  if (InventoryProduct.sequelize.getDialect() === "postgres") {
    return {
      [Op.and]: [
        sqlWhere(literal('"InventoryProduct"."barcode" COLLATE "C"'), barcode)
      ]
    };
  }
  return { barcode };
}

export async function assertInventoryBarcodeUnique(
  companyId: number,
  barcode: string | null,
  excludeId?: number
): Promise<void> {
  if (barcode === null) return;
  const existing = await InventoryProduct.findOne({
    where: {
      companyId,
      ...inventoryBarcodeWhere(barcode),
      ...(excludeId != null ? { id: { [Op.ne]: excludeId } } : {})
    },
    attributes: ["id"]
  });
  if (existing) {
    throw new AppError("ERR_INVENTORY_PRODUCT_BARCODE_DUPLICATE", 400);
  }
}

/** Só traduz o índice desta fase; outras constraints/erros mantêm seu tratamento. */
export function rethrowInventoryBarcodeConstraint(error: unknown): never {
  if (error instanceof UniqueConstraintError) {
    const parent = error.parent as { constraint?: string; sqlMessage?: string };
    // PG informa constraint; mysql2 informa o nome da chave no final da mensagem.
    // Não procura o nome no valor duplicado (que pode ser um barcode arbitrário).
    const mysqlKey = parent?.sqlMessage?.match(
      /for key ['`]([^'`]+)['`]\s*$/i
    )?.[1];
    if (
      parent?.constraint === INVENTORY_BARCODE_INDEX ||
      mysqlKey?.split(".").pop() === INVENTORY_BARCODE_INDEX
    ) {
      throw new AppError("ERR_INVENTORY_PRODUCT_BARCODE_DUPLICATE", 400);
    }
  }
  throw error;
}
