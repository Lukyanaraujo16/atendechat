import { Op, col, where as sequelizeWhere } from "sequelize";
import { inventoryBarcodeWhere } from "./inventoryBarcode";
import AppError from "../../errors/AppError";
import InventoryCategory from "../../models/InventoryCategory";
import InventoryProduct from "../../models/InventoryProduct";
import { inventoryInsensitiveLike } from "./inventoryTextMatch";
import { parseBooleanQuery } from "./inventoryTenant";

const MAX_PRODUCT_LIST_LIMIT = 50;

/**
 * Limite opcional da listagem.
 * Ausente, null ou string vazia preserva o comportamento legado (sem LIMIT).
 * Valor presente precisa ser inteiro de 1 a 50. Fora disso, 400.
 * Não faz clamp: a aba Produtos omite o parâmetro e continua recebendo a lista inteira.
 */
export function parseOptionalProductListLimit(
  value: unknown
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "object") {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Limite inválido.");
  }
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Limite inválido.");
  }
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PRODUCT_LIST_LIMIT) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Limite inválido.");
  }
  return limit;
}

function normalizeSearch(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function buildBaseWhere(input: {
  companyId: number;
  categoryId?: unknown;
  active?: unknown;
  lowStock?: unknown;
}): any {
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

  const lowStock = parseBooleanQuery(input.lowStock);
  if (lowStock === true) {
    where[Op.and] = [
      { minStock: { [Op.ne]: null } },
      sequelizeWhere(col("currentQuantity"), "<=", col("minStock"))
    ];
  }

  return where;
}

function partialMatch(search: string) {
  return ["name", "sku", "barcode"].map(column =>
    inventoryInsensitiveLike(column, search, undefined, "InventoryProduct")
  );
}

const productInclude = [
  {
    model: InventoryCategory,
    attributes: ["id", "name"],
    required: false
  }
];

function findProducts(where: any, limit?: number) {
  return InventoryProduct.findAll({
    where,
    order: [
      ["name", "ASC"],
      ["id", "ASC"]
    ],
    include: productInclude,
    ...(limit != null ? { limit } : {})
  });
}

function appendUnique(
  current: InventoryProduct[],
  extra: InventoryProduct[]
): InventoryProduct[] {
  const seen = new Set(current.map(row => row.id));
  const next = current.slice();
  extra.forEach(row => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    next.push(row);
  });
  return next;
}

function excludeIds(where: any, ids: number[]) {
  if (!ids.length) return where;
  return {
    ...where,
    id: { [Op.notIn]: ids }
  };
}

/**
 * Com search + limit, a ordem é:
 * 1. barcode igual ao termo, comparação binária, sem remover caracteres;
 * 2. SKU igual ao termo, que ainda não entrou;
 * 3. busca parcial insensível a caixa; o nome também ignora acento.
 * A unicidade por empresa é garantida pelo índice de barcode.
 * Sem limit, uma única query LIKE, como antes.
 */
async function findRanked(
  baseWhere: any,
  search: string,
  limit: number
): Promise<InventoryProduct[]> {
  const barcodeWhere = inventoryBarcodeWhere(search);
  const exactBarcode = await findProducts(
    {
      ...baseWhere,
      ...barcodeWhere,
      [Op.and]: [...(baseWhere[Op.and] || []), ...(barcodeWhere[Op.and] || [])]
    },
    limit
  );
  let merged = exactBarcode;

  if (merged.length < limit) {
    const exactSku = await findProducts(
      excludeIds(
        { ...baseWhere, sku: search },
        merged.map(row => row.id)
      ),
      limit - merged.length
    );
    merged = appendUnique(merged, exactSku);
  }

  if (merged.length < limit) {
    const partial = await findProducts(
      excludeIds(
        { ...baseWhere, [Op.or]: partialMatch(search) },
        merged.map(row => row.id)
      ),
      limit - merged.length
    );
    merged = appendUnique(merged, partial);
  }

  return merged.slice(0, limit);
}

export default async function ListInventoryProductsService(input: {
  companyId: number;
  search?: unknown;
  categoryId?: unknown;
  active?: unknown;
  lowStock?: unknown;
  limit?: unknown;
}): Promise<InventoryProduct[]> {
  const limit = parseOptionalProductListLimit(input.limit);
  const baseWhere = buildBaseWhere(input);
  const search = normalizeSearch(input.search);

  if (search && limit != null) {
    return findRanked(baseWhere, search, limit);
  }

  const where = search
    ? { ...baseWhere, [Op.or]: partialMatch(search) }
    : baseWhere;

  return findProducts(where, limit);
}
