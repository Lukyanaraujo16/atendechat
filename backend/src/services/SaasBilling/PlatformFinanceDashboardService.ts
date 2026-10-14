import { Op } from "sequelize";
import moment from "moment";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import { getCompanyEffectivePlanValue } from "../../helpers/getCompanyEffectivePlanValue";
import { getCompanyFinanceFlags } from "../../helpers/companyFinanceStatus";
import { getRecurrenceMonths } from "../../helpers/recurrenceMonths";

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza valor contratado para mensal (MRR). */
function toMonthly(value: number, recurrence: string | null | undefined): number {
  const months = getRecurrenceMonths(recurrence) || 1;
  return value / months;
}

export async function getPlatformFinanceKpis(opts?: {
  from?: string;
  to?: string;
}) {
  const from = opts?.from ? moment(opts.from).startOf("day") : null;
  const to = opts?.to ? moment(opts.to).endOf("day") : null;

  const companies = await Company.findAll({
    include: [{ model: Plan, as: "plan" }]
  });

  let mrr = 0;
  let delinquentCount = 0;
  let overdueCount = 0;
  let activeCount = 0;
  const planDistribution: Record<
    string,
    { planId: number | null; name: string; count: number; mrr: number }
  > = {};

  for (const c of companies) {
    if (c.status === false) continue;
    activeCount += 1;
    const value = getCompanyEffectivePlanValue({
      contractedPlanValue: (c as any).contractedPlanValue,
      plan: c.plan
    });
    const monthly = toMonthly(value, c.recurrence);
    mrr += monthly;

    const flags = getCompanyFinanceFlags(c);
    if (flags.delinquent) delinquentCount += 1;
    if (flags.overdue) overdueCount += 1;

    const key = String(c.planId || "none");
    if (!planDistribution[key]) {
      planDistribution[key] = {
        planId: c.planId || null,
        name: c.plan?.name || "Sem plano",
        count: 0,
        mrr: 0
      };
    }
    planDistribution[key].count += 1;
    planDistribution[key].mrr += monthly;
  }

  const invoiceWhere: any = {};
  if (from || to) {
    invoiceWhere.createdAt = {};
    if (from) invoiceWhere.createdAt[Op.gte] = from.toDate();
    if (to) invoiceWhere.createdAt[Op.lte] = to.toDate();
  }

  const invoices = await Invoices.findAll({ where: invoiceWhere });
  let invoiced = 0;
  let openAmount = 0;
  let overdueAmount = 0;
  const today = moment().startOf("day");

  for (const inv of invoices) {
    const status = String(inv.status).toLowerCase();
    if (status === "cancelled") continue;
    const value = toNumber(inv.value);
    invoiced += value;
    if (status !== "paid") {
      openAmount += value;
      const due = moment(inv.dueDate).startOf("day");
      if (due.isValid() && due.isBefore(today)) {
        overdueAmount += value;
      }
    }
  }

  const paymentWhere: any = { countsAsRevenue: true };
  if (from || to) {
    paymentWhere.paidAt = {};
    if (from) paymentWhere.paidAt[Op.gte] = from.toDate();
    if (to) paymentWhere.paidAt[Op.lte] = to.toDate();
  }

  const payments = await SaaSPayment.findAll({ where: paymentWhere });
  let received = 0;
  for (const p of payments) {
    received += toNumber(p.amount);
  }

  // Evolução mensal (últimos 6 meses) — faturamento e recebimento
  const evolution: Array<{ month: string; invoiced: number; received: number }> =
    [];
  for (let i = 5; i >= 0; i -= 1) {
    const m = moment().subtract(i, "months");
    const key = m.format("YYYY-MM");
    const start = m.clone().startOf("month");
    const end = m.clone().endOf("month");
    let invSum = 0;
    let paySum = 0;
    for (const inv of invoices) {
      const created = moment(inv.createdAt);
      if (created.isBetween(start, end, undefined, "[]")) {
        if (String(inv.status).toLowerCase() !== "cancelled") {
          invSum += toNumber(inv.value);
        }
      }
    }
    for (const p of payments) {
      const paidAt = moment(p.paidAt);
      if (paidAt.isBetween(start, end, undefined, "[]")) {
        paySum += toNumber(p.amount);
      }
    }
    evolution.push({ month: key, invoiced: invSum, received: paySum });
  }

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    invoiced: Math.round(invoiced * 100) / 100,
    received: Math.round(received * 100) / 100,
    open: Math.round(openAmount * 100) / 100,
    overdueAmount: Math.round(overdueAmount * 100) / 100,
    activeCompanies: activeCount,
    overdueCompanies: overdueCount,
    delinquentCompanies: delinquentCount,
    planDistribution: Object.values(planDistribution),
    evolution,
    period: {
      from: from?.format("YYYY-MM-DD") || null,
      to: to?.format("YYYY-MM-DD") || null
    }
  };
}

export async function listPlatformInvoices(opts: {
  searchParam?: string;
  status?: string;
  companyId?: number;
  planId?: number;
  pageNumber?: string;
  competence?: string;
}) {
  const page = Math.max(1, parseInt(opts.pageNumber || "1", 10) || 1);
  const limit = 20;
  const where: any = {};

  if (opts.status) where.status = opts.status;
  if (opts.companyId) where.companyId = opts.companyId;
  if (opts.competence) where.competence = opts.competence;
  if (opts.planId) where.planIdSnapshot = opts.planId;
  if (opts.searchParam) {
    where.detail = { [Op.iLike]: `%${opts.searchParam}%` };
  }

  const { rows, count } = await Invoices.findAndCountAll({
    where,
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "name", "email", "planId", "dueDate", "status"]
      }
    ],
    order: [["dueDate", "DESC"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit
  });

  return { invoices: rows, count, hasMore: count > page * limit };
}

export async function listPlatformPayments(opts: {
  companyId?: number;
  pageNumber?: string;
  onlyRevenue?: boolean;
}) {
  const page = Math.max(1, parseInt(opts.pageNumber || "1", 10) || 1);
  const limit = 20;
  const where: any = {};
  if (opts.companyId) where.companyId = opts.companyId;
  if (opts.onlyRevenue !== false) where.countsAsRevenue = true;

  const { rows, count } = await SaaSPayment.findAndCountAll({
    where,
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "name"]
      }
    ],
    order: [["paidAt", "DESC"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit
  });

  return { payments: rows, count, hasMore: count > page * limit };
}
