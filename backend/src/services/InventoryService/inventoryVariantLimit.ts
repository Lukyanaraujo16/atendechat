import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryProductVariant from "../../models/InventoryProductVariant";
import { MAX_VARIANTS_PER_PRODUCT } from "./inventoryVariantCombination";

/**
 * Conta variações ativas do produto. O chamador deve manter o produto travado
 * (findInventoryProductOrThrow com transação = FOR UPDATE) para serializar escritas concorrentes.
 */
export async function countActiveVariants(
  companyId: number,
  productId: number,
  transaction: Transaction
): Promise<number> {
  return InventoryProductVariant.count({
    where: { companyId, productId, active: true },
    transaction
  });
}

/**
 * Bloqueia aumento de variações ativas acima do limite. Produto legado já acima
 * do limite pode manter ou reduzir, nunca aumentar.
 */
export function assertActiveVariantLimit(
  activeAfter: number,
  activeBefore: number
): void {
  if (activeAfter > MAX_VARIANTS_PER_PRODUCT && activeAfter > activeBefore) {
    throw new AppError(
      "ERR_INVENTORY_VARIANT_LIMIT",
      400,
      `Limite de ${MAX_VARIANTS_PER_PRODUCT} variações ativas por produto atingido.`
    );
  }
}
