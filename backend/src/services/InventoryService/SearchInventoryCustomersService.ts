import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import InventoryCustomer from "../../models/InventoryCustomer";
import {
  normalizeDocumentDigits,
  normalizePhoneDigits
} from "./inventoryDocumentHelpers";
import {
  computeCreditAvailable,
  computeCustomerCreditUsed
} from "./inventoryCustomerCredit";
import { inventoryInsensitiveLike } from "./inventoryTextMatch";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

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
  document: string | null;
  phone: string | null;
  type: string;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  isActive: boolean;
  postalCode: string | null;
  street: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  contactId: number | null;
};

/**
 * Busca Clientes comerciais do PDV (InventoryCustomer).
 */
export default async function SearchInventoryCustomersService(input: {
  companyId: number;
  search?: unknown;
  limit?: unknown;
  activeOnly?: boolean;
}): Promise<InventoryCustomerOption[]> {
  const limit = parseInventoryCustomerSearchLimit(input.limit);
  const search = normalizeSearch(input.search);
  const where: any = { companyId: input.companyId };
  if (input.activeOnly !== false) {
    where.isActive = true;
  }
  if (search) {
    const doc = normalizeDocumentDigits(search);
    const phone = normalizePhoneDigits(search);
    const or: any[] = [inventoryInsensitiveLike("name", search)];
    if (doc) or.push({ document: { [Op.like]: `%${doc}%` } });
    if (phone) or.push({ phone: { [Op.like]: `%${phone}%` } });
    where[Op.or] = or;
  }

  const rows = await InventoryCustomer.findAll({
    where,
    limit,
    order: [
      ["name", "ASC"],
      ["id", "ASC"]
    ]
  });

  const options: InventoryCustomerOption[] = [];
  for (const row of rows) {
    const used = await computeCustomerCreditUsed(input.companyId, row.id);
    const creditLimit = roundMoney(toMoney(row.creditLimit));
    options.push({
      id: row.id,
      name: row.name,
      number: row.phone || "",
      document: row.document,
      phone: row.phone,
      type: row.type,
      creditLimit,
      creditUsed: used.creditUsed,
      creditAvailable: computeCreditAvailable(creditLimit, used.creditUsed),
      isActive: row.isActive === true,
      postalCode: row.postalCode,
      street: row.street,
      addressNumber: row.addressNumber,
      addressComplement: row.addressComplement,
      district: row.district,
      city: row.city,
      state: row.state,
      contactId: row.contactId
    });
  }
  return options;
}
