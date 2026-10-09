import { Op } from "sequelize";
import InventoryReceivableInstallment from "../../models/InventoryReceivableInstallment";
import { todayCivilDate } from "./inventoryReceivableHelpers";
import { roundMoney, toMoney } from "./inventorySaleHelpers";

function addCivilDaysSafe(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  const ny = base.getUTCFullYear();
  const nm = String(base.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(base.getUTCDate()).padStart(2, "0");
  return `${ny}-${nm}-${nd}`;
}

export default async function GetInventoryReceivableSummaryService(input: {
  companyId: number;
  customerId?: unknown;
}): Promise<{
  openAmount: number;
  overdueAmount: number;
  dueTodayAmount: number;
  next7DaysAmount: number;
}> {
  const today = todayCivilDate();
  const next7 = addCivilDaysSafe(today, 7);
  const where: any = {
    companyId: input.companyId,
    status: { [Op.in]: ["open", "partial"] }
  };

  const include: any[] = [];
  if (input.customerId != null && input.customerId !== "") {
    include.push({
      association: "receivable",
      required: true,
      where: {
        companyId: input.companyId,
        customerId: Number(input.customerId)
      },
      attributes: []
    });
  }

  const rows = await InventoryReceivableInstallment.findAll({
    where,
    include: include.length ? include : undefined,
    attributes: ["dueDate", "openAmount", "status"]
  });

  let openAmount = 0;
  let overdueAmount = 0;
  let dueTodayAmount = 0;
  let next7DaysAmount = 0;

  for (const row of rows) {
    const open = roundMoney(toMoney(row.openAmount));
    openAmount = roundMoney(openAmount + open);
    const due = String(row.dueDate);
    if (due < today) {
      overdueAmount = roundMoney(overdueAmount + open);
    } else if (due === today) {
      dueTodayAmount = roundMoney(dueTodayAmount + open);
    } else if (due > today && due <= next7) {
      next7DaysAmount = roundMoney(next7DaysAmount + open);
    }
  }

  return { openAmount, overdueAmount, dueTodayAmount, next7DaysAmount };
}
