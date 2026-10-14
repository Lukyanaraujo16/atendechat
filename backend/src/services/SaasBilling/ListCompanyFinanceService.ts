import { Op } from "sequelize";
import moment from "moment";
import Company from "../../models/Company";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSSubscriptionRenewal from "../../models/SaaSSubscriptionRenewal";
import SaaSFinancialEvent from "../../models/SaaSFinancialEvent";
import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import Plan from "../../models/Plan";
import AppError from "../../errors/AppError";
import { getCompanyEffectivePlanValue } from "../../helpers/getCompanyEffectivePlanValue";
import { getCompanyFinanceFlags } from "../../helpers/companyFinanceStatus";

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getCompanyFinanceSummary(companyId: number) {
  const company = await Company.findByPk(companyId, {
    include: [{ model: Plan, as: "plan" }]
  });
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const invoices = await Invoices.findAll({ where: { companyId } });
  const payments = await SaaSPayment.findAll({
    where: { companyId, countsAsRevenue: true }
  });

  const today = moment().startOf("day");
  let totalInvoiced = 0;
  let totalReceived = 0;
  let totalOpen = 0;
  let totalOverdue = 0;

  for (const inv of invoices) {
    const status = String(inv.status).toLowerCase();
    const value = toNumber(inv.value);
    if (status === "cancelled") continue;
    totalInvoiced += value;
    if (status === "paid") {
      // receita vem de payments countsAsRevenue
    } else {
      totalOpen += value;
      const due = moment(inv.dueDate).startOf("day");
      if (due.isValid() && due.isBefore(today)) {
        totalOverdue += value;
      }
    }
  }

  for (const p of payments) {
    totalReceived += toNumber(p.amount);
  }

  const contracted = getCompanyEffectivePlanValue({
    contractedPlanValue: (company as any).contractedPlanValue,
    plan: company.plan
  });

  const flags = getCompanyFinanceFlags(company);

  return {
    companyId: company.id,
    companyName: company.name,
    planId: company.planId,
    planName: company.plan?.name || null,
    contractedValue: contracted,
    recurrence: company.recurrence,
    dueDate: company.dueDate,
    status: company.status,
    financeFlags: flags,
    totals: {
      invoiced: totalInvoiced,
      received: totalReceived,
      open: totalOpen,
      overdue: totalOverdue
    }
  };
}

export async function listCompanyInvoices(
  companyId: number,
  opts?: { status?: string; page?: number; limit?: number }
) {
  const page = Math.max(1, opts?.page || 1);
  const limit = Math.min(100, Math.max(1, opts?.limit || 20));
  const where: any = { companyId };
  if (opts?.status) {
    where.status = opts.status;
  }

  const { rows, count } = await Invoices.findAndCountAll({
    where,
    order: [["dueDate", "DESC"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit
  });

  return {
    invoices: rows,
    count,
    page,
    limit,
    hasMore: count > page * limit
  };
}

export async function listCompanyPayments(
  companyId: number,
  opts?: { page?: number; limit?: number }
) {
  const page = Math.max(1, opts?.page || 1);
  const limit = Math.min(100, Math.max(1, opts?.limit || 20));
  const { rows, count } = await SaaSPayment.findAndCountAll({
    where: { companyId },
    order: [["paidAt", "DESC"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit
  });
  return {
    payments: rows,
    count,
    page,
    limit,
    hasMore: count > page * limit
  };
}

export async function listCompanyRenewals(companyId: number) {
  return SaaSSubscriptionRenewal.findAll({
    where: { companyId },
    order: [["id", "DESC"]],
    limit: 100
  });
}

export async function listCompanyFinancialEvents(companyId: number) {
  return SaaSFinancialEvent.findAll({
    where: { companyId },
    order: [["id", "DESC"]],
    limit: 100
  });
}

export async function listCompanyReconciliation(companyId: number) {
  return SaaSReconciliationItem.findAll({
    where: { companyId, status: { [Op.ne]: "resolved" } },
    order: [["id", "DESC"]],
    limit: 50
  });
}

export async function getInvoiceDetailForCompany(
  companyId: number,
  invoiceId: number
) {
  const invoice = await Invoices.findOne({
    where: { id: invoiceId, companyId }
  });
  if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

  const payments = await SaaSPayment.findAll({
    where: { invoiceId },
    order: [["id", "DESC"]]
  });
  const events = await SaaSFinancialEvent.findAll({
    where: { invoiceId },
    order: [["id", "DESC"]],
    limit: 50
  });
  const renewals = await SaaSSubscriptionRenewal.findAll({
    where: { invoiceId },
    order: [["id", "DESC"]]
  });
  const reconciliation = await SaaSReconciliationItem.findAll({
    where: { invoiceId },
    order: [["id", "DESC"]]
  });

  return { invoice, payments, events, renewals, reconciliation };
}
