import { Op } from "sequelize";
import InventoryCustomer from "../../models/InventoryCustomer";
import { customerToJSON } from "./inventoryCustomerHelpers";
import {
  computeCustomerCreditUsed,
  computeCreditAvailable
} from "./inventoryCustomerCredit";
import { inventoryInsensitiveLike } from "./inventoryTextMatch";
import { normalizeDocumentDigits, normalizePhoneDigits } from "./inventoryDocumentHelpers";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return DEFAULT_LIMIT;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function parsePage(value: unknown): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return 1;
  return n;
}

export default async function ListInventoryCustomersService(input: {
  companyId: number;
  search?: unknown;
  isActive?: unknown;
  withOpenBalance?: unknown;
  withOverdue?: unknown;
  page?: unknown;
  limit?: unknown;
  includeFinancials?: boolean;
}): Promise<{
  customers: Array<Record<string, unknown>>;
  count: number;
  page: number;
  limit: number;
}> {
  const limit = parseLimit(input.limit);
  const page = parsePage(input.page);
  const offset = (page - 1) * limit;
  const where: any = { companyId: input.companyId };

  if (
    input.isActive === true ||
    input.isActive === "true" ||
    input.isActive === "1"
  ) {
    where.isActive = true;
  } else if (
    input.isActive === false ||
    input.isActive === "false" ||
    input.isActive === "0"
  ) {
    where.isActive = false;
  }

  const search = String(input.search ?? "").trim();
  if (search) {
    const doc = normalizeDocumentDigits(search);
    const phone = normalizePhoneDigits(search);
    const or: any[] = [inventoryInsensitiveLike("name", search)];
    if (doc) or.push({ document: { [Op.like]: `%${doc}%` } });
    if (phone) or.push({ phone: { [Op.like]: `%${phone}%` } });
    where[Op.or] = or;
  }

  const { rows, count } = await InventoryCustomer.findAndCountAll({
    where,
    limit,
    offset,
    order: [
      ["name", "ASC"],
      ["id", "ASC"]
    ]
  });

  const wantFinancials = input.includeFinancials !== false;
  const withOpen =
    input.withOpenBalance === true ||
    input.withOpenBalance === "true" ||
    input.withOpenBalance === "1";
  const withOverdue =
    input.withOverdue === true ||
    input.withOverdue === "true" ||
    input.withOverdue === "1";

  const customers: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const base = customerToJSON(row, {
      includeCreditLimit: wantFinancials
    }) as Record<string, unknown>;
    if (wantFinancials) {
      const used = await computeCustomerCreditUsed(input.companyId, row.id);
      const creditLimit = roundMoney(toMoney(row.creditLimit));
      base.credit = {
        customerId: row.id,
        creditLimit,
        creditUsed: used.creditUsed,
        creditAvailable: computeCreditAvailable(creditLimit, used.creditUsed),
        openAmount: used.openAmount,
        overdueOpenAmount: used.overdueOpenAmount
      };
      if (withOpen && used.openAmount <= 0) continue;
      if (withOverdue && used.overdueOpenAmount <= 0) continue;
    }
    customers.push(base);
  }

  return { customers, count, page, limit };
}
