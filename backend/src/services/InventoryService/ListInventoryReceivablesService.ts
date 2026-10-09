import { Op } from "sequelize";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import InventoryReceivable from "../../models/InventoryReceivable";
import InventoryCustomer from "../../models/InventoryCustomer";
import InventorySale from "../../models/InventorySale";
import {
  mapInstallmentRow,
  todayCivilDate,
  InstallmentListItem
} from "./inventoryReceivableHelpers";
import { inventoryInsensitiveLike } from "./inventoryTextMatch";
import {
  normalizeDocumentDigits,
  normalizePhoneDigits
} from "./inventoryDocumentHelpers";
import { assertCivilDateString } from "./inventoryStoreCreditSchedule";

function addCivilDaysSafe(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  const ny = base.getUTCFullYear();
  const nm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(base.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

export default async function ListInventoryReceivablesService(input: {
  companyId: number;
  search?: unknown;
  status?: unknown;
  customerId?: unknown;
  dueFrom?: unknown;
  dueTo?: unknown;
  bucket?: unknown; // overdue | today | next7 | open
  page?: unknown;
  limit?: unknown;
}): Promise<{
  installments: InstallmentListItem[];
  count: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, Number(input.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(input.limit) || 50));
  const offset = (page - 1) * limit;
  const today = todayCivilDate();

  const where: any = { companyId: input.companyId };
  const receivableWhere: any = { companyId: input.companyId };
  const customerWhere: any = {};

  const status = String(input.status ?? "").trim();
  if (status === "overdue") {
    where.status = { [Op.in]: ["open", "partial"] };
    where.dueDate = { [Op.lt]: today };
  } else if (status && status !== "all") {
    where.status = status;
  }

  const bucket = String(input.bucket ?? "").trim();
  if (bucket === "overdue") {
    where.status = { [Op.in]: ["open", "partial"] };
    where.dueDate = { [Op.lt]: today };
  } else if (bucket === "today") {
    where.status = { [Op.in]: ["open", "partial"] };
    where.dueDate = today;
  } else if (bucket === "next7") {
    where.status = { [Op.in]: ["open", "partial"] };
    where.dueDate = {
      [Op.gt]: today,
      [Op.lte]: addCivilDaysSafe(today, 7)
    };
  } else if (bucket === "open") {
    where.status = { [Op.in]: ["open", "partial"] };
  }

  if (input.dueFrom) {
    const from = assertCivilDateString(input.dueFrom);
    where.dueDate = { ...(where.dueDate || {}), [Op.gte]: from };
  }
  if (input.dueTo) {
    const to = assertCivilDateString(input.dueTo);
    where.dueDate = { ...(where.dueDate || {}), [Op.lte]: to };
  }

  if (input.customerId != null && input.customerId !== "") {
    receivableWhere.customerId = Number(input.customerId);
  }

  const search = String(input.search ?? "").trim();
  let customerRequired = false;
  if (search) {
    const doc = normalizeDocumentDigits(search);
    const phone = normalizePhoneDigits(search);
    const or: any[] = [inventoryInsensitiveLike("name", search)];
    if (doc) or.push({ document: { [Op.like]: `%${doc}%` } });
    if (phone) or.push({ phone: { [Op.like]: `%${phone}%` } });
    customerWhere[Op.or] = or;
    customerRequired = true;
  }

  const { rows, count } = await InventoryReceivableInstallment.findAndCountAll({
    where,
    include: [
      {
        model: InventoryReceivable,
        required: true,
        where: receivableWhere,
        include: [
          {
            model: InventoryCustomer,
            required: customerRequired,
            where: customerRequired ? customerWhere : undefined,
            attributes: ["id", "name", "document", "phone"]
          },
          {
            model: InventorySale,
            required: false,
            attributes: ["id", "saleNumber"]
          }
        ]
      }
    ],
    order: [
      ["dueDate", "ASC"],
      ["id", "ASC"]
    ],
    limit,
    offset,
    distinct: true
  });

  const installments = rows.map(inst => {
    const recv = inst.receivable;
    const customer = recv?.customer;
    return mapInstallmentRow(
      inst,
      {
        customerId: recv?.customerId ?? 0,
        customerName: customer?.name ?? null,
        customerDocument: customer?.document ?? null,
        saleId: recv?.saleId ?? null,
        saleNumber: recv?.sale?.saleNumber ?? null,
        originType: recv?.originType ?? "store_credit"
      },
      today
    );
  });

  return { installments, count, page, limit };
}
