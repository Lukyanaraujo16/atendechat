import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";

const DEFAULT_CUSTOMER_SEARCH_LIMIT = 20;
const MAX_CUSTOMER_SEARCH_LIMIT = 50;

/**
 * Limite da busca de clientes da venda.
 * Ausente, null ou string vazia usa 20. Valor presente precisa ser inteiro de 1 a 50.
 * Não faz clamp.
 */
export function parseInventoryCustomerSearchLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_CUSTOMER_SEARCH_LIMIT;
  }
  if (typeof value === "object") {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Limite inválido.");
  }
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Limite inválido.");
  }
  const limit = Number(raw);
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_CUSTOMER_SEARCH_LIMIT
  ) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Limite inválido.");
  }
  return limit;
}

function normalizeSearch(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export type InventoryCustomerOption = {
  id: number;
  name: string;
  number: string;
};

export default async function SearchInventoryCustomersService(input: {
  companyId: number;
  search?: unknown;
  limit?: unknown;
}): Promise<InventoryCustomerOption[]> {
  const limit = parseInventoryCustomerSearchLimit(input.limit);
  const search = normalizeSearch(input.search);
  if (!search) return [];

  const term = `%${search}%`;
  const rows = await Contact.findAll({
    where: {
      companyId: input.companyId,
      [Op.or]: [{ name: { [Op.like]: term } }, { number: { [Op.like]: term } }]
    },
    attributes: ["id", "name", "number"],
    limit,
    order: [
      ["name", "ASC"],
      ["id", "ASC"]
    ]
  });

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    number: row.number
  }));
}
