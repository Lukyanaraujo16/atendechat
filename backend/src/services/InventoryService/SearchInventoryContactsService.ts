import { Op } from "sequelize";
import Contact from "../../models/Contact";
import { inventoryInsensitiveLike } from "./inventoryTextMatch";
import { parseInventoryCustomerSearchLimit } from "./SearchInventoryCustomersService";

function normalizeSearch(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Busca Contacts (atendimento) para vínculo/prefill de Cliente comercial.
 */
export default async function SearchInventoryContactsService(input: {
  companyId: number;
  search?: unknown;
  limit?: unknown;
}) {
  const limit = parseInventoryCustomerSearchLimit(input.limit);
  const search = normalizeSearch(input.search);
  const where: any = { companyId: input.companyId };
  if (search) {
    where[Op.or] = [
      inventoryInsensitiveLike("name", search),
      { number: { [Op.like]: `%${search}%` } }
    ];
  }

  const rows = await Contact.findAll({
    where,
    attributes: [
      "id",
      "name",
      "number",
      "email",
      "postalCode",
      "street",
      "addressNumber",
      "addressComplement",
      "district",
      "city",
      "state"
    ],
    limit,
    order: [
      ["name", "ASC"],
      ["id", "ASC"]
    ]
  });

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    number: row.number,
    email: row.email,
    postalCode: row.postalCode,
    street: row.street,
    addressNumber: row.addressNumber,
    addressComplement: row.addressComplement,
    district: row.district,
    city: row.city,
    state: row.state
  }));
}
