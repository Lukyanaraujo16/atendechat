import { Op, fn, col } from "sequelize";
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
import {
  resolveSaasTimezone,
  toDomainDate,
  todayDomainDate
} from "../../helpers/saasDueDate";
import { countHistoricalReviewPending } from "./HistoricalReviewService";

function toNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Fatura considerada "em aberto" (não paga e não cancelada). */
function isOpenStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase();
  return s !== "paid" && s !== "cancelled";
}

function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Serializa o pagamento marcando explicitamente "data desconhecida" (paidAt NULL). */
export function withPaidAtUnknown(p: any) {
  const json: any = p && typeof p.toJSON === "function" ? p.toJSON() : { ...p };
  json.paidAtUnknown = json.paidAt === null || json.paidAt === undefined;
  return json;
}

export async function getCompanyFinanceSummary(companyId: number) {
  const company = await Company.findByPk(companyId, {
    include: [{ model: Plan, as: "plan" }]
  });
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const invoices = await Invoices.findAll({ where: { companyId } });
  const payments = await SaaSPayment.findAll({ where: { companyId } });

  const tz = resolveSaasTimezone(company.timezone);
  const today = todayDomainDate(tz);
  let totalBilled = 0;
  let totalReceived = 0;
  let totalCourtesy = 0;
  let totalOpen = 0;
  let totalOverdue = 0;
  let openCount = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    const status = String(inv.status).toLowerCase();
    const value = toNumber(inv.value);
    if (status === "cancelled") continue;
    totalBilled += value;
    if (isOpenStatus(status)) {
      totalOpen += value;
      openCount += 1;
      const due = toDomainDate(inv.dueDate as any, tz);
      if (due && due < today) {
        totalOverdue += value;
        overdueCount += 1;
      }
    }
  }

  let totalReceivedDateUnknown = 0;
  let totalHistoricalReceived = 0;
  let totalHistoricalCourtesy = 0;
  for (const p of payments) {
    const amount = toNumber(p.amount);
    const source = String((p as any).source || "");
    // Cortesia (countsAsRevenue=false) nunca entra como receita.
    if ((p as any).countsAsRevenue === false) {
      totalCourtesy += amount;
      if (source === "historical_courtesy") totalHistoricalCourtesy += amount;
    } else {
      // Pagamento histórico com data desconhecida entra no recebido e aparece separado.
      totalReceived += amount;
      if (p.paidAt === null || p.paidAt === undefined) totalReceivedDateUnknown += amount;
      if (source === "historical_payment") totalHistoricalReceived += amount;
    }
  }

  const historicalPending = await countHistoricalReviewPending(company.id);

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
    plan: company.plan
      ? { id: company.plan.id, name: company.plan.name }
      : null,
    contractedValue: contracted,
    recurrence: company.recurrence,
    /** Valor bruto (compatibilidade); prefira `nextDueDate`. */
    dueDate: company.dueDate,
    nextDueDate: toDomainDate(company.dueDate as any, tz),
    timezone: tz,
    status: company.status,
    financeFlags: flags,
    totals: {
      billed: roundMoney(totalBilled),
      /** @deprecated alias de `billed` mantido por compatibilidade */
      invoiced: roundMoney(totalBilled),
      received: roundMoney(totalReceived),
      courtesy: roundMoney(totalCourtesy),
      open: roundMoney(totalOpen),
      overdue: roundMoney(totalOverdue),
      openCount,
      overdueCount,
      /** Parte de `received` sem data conhecida (regularização histórica). */
      receivedDateUnknown: roundMoney(totalReceivedDateUnknown),
      /** Parte de `received` vinda de regularização histórica. */
      historicalReceived: roundMoney(totalHistoricalReceived),
      /** Parte de `courtesy` vinda de regularização histórica. */
      historicalCourtesy: roundMoney(totalHistoricalCourtesy),
      /** Faturas históricas ainda não regularizadas (C5). */
      historicalPending
    }
  };
}

export async function listCompanyInvoices(
  companyId: number,
  opts?: { status?: string; legacy?: boolean; page?: number; limit?: number }
) {
  const page = Math.max(1, opts?.page || 1);
  const limit = Math.min(100, Math.max(1, opts?.limit || 20));
  const where: any = { companyId };
  if (opts?.status) {
    where.status = opts.status;
  }
  if (opts?.legacy === true) {
    where[Op.or] = [{ legacyUnknown: true }, { cycleKey: null }];
  } else if (opts?.legacy === false) {
    where.legacyUnknown = { [Op.not]: true };
    where.cycleKey = { [Op.ne]: null };
  }

  const { rows, count } = await Invoices.findAndCountAll({
    where,
    order: [["dueDate", "DESC"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit
  });

  const company = await Company.findByPk(companyId, {
    attributes: ["id", "timezone"]
  });
  const tz = resolveSaasTimezone(company?.timezone);
  const today = todayDomainDate(tz);

  const ids = rows.map(r => r.id);
  const countsByInvoice = new Map<number, number>();
  if (ids.length) {
    const grouped = (await SaaSPayment.findAll({
      attributes: ["invoiceId", [fn("COUNT", col("id")), "count"]],
      where: { companyId, invoiceId: { [Op.in]: ids } },
      group: ["invoiceId"],
      raw: true
    })) as unknown as Array<{ invoiceId: number; count: string | number }>;
    for (const g of grouped) {
      countsByInvoice.set(Number(g.invoiceId), Number(g.count) || 0);
    }
  }

  const invoices = rows.map(r => {
    const json: any = typeof r.toJSON === "function" ? r.toJSON() : r;
    const status = String(json.status || "").toLowerCase();
    const due = toDomainDate(json.dueDate, tz);
    return {
      ...json,
      isLegacy: json.legacyUnknown === true || !json.cycleKey,
      isOverdue: isOpenStatus(status) && !!due && due < today,
      paymentsCount: countsByInvoice.get(Number(json.id)) || 0
    };
  });

  return {
    invoices,
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
    // Pagamentos sem data (histórico) vão para o fim, nunca numa posição inventada.
    order: [["paidAt", "DESC NULLS LAST"], ["id", "DESC"]],
    limit,
    offset: (page - 1) * limit
  });
  return {
    payments: rows.map(withPaidAtUnknown),
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

  const payments = (
    await SaaSPayment.findAll({
      where: { invoiceId, companyId },
      order: [["id", "DESC"]]
    })
  ).map(withPaidAtUnknown);
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
