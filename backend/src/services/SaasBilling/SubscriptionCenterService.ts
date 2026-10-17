/**
 * Fase 8.4-F (F1) — Central de assinatura por empresa (contrato C3).
 *
 * SOMENTE LEITURA. Fontes autoritativas: Company + Plan (cadastro), motor C1 `evaluateCompanyBilling`
 * com as configurações reais do sistema (status financeiro/bloqueio), `planSubscriptionRenewal`
 * (próximo vencimento = mesma regra da renovação), SaaSPayment (último pagamento que conta como
 * receita), Invoices (pendências), SaaSReconciliationItem e a fila de regularização histórica (C5).
 *
 * Três dimensões separadas (F-D2): operação (ativa/bloqueada + tipo de bloqueio), financeiro
 * (motor C1) e assinatura (em dia / vencida / sem vencimento). Empresa ativa ≠ assinatura em dia.
 */
import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSReconciliationItem from "../../models/SaaSReconciliationItem";
import SaaSInvoiceHistoricalReview from "../../models/SaaSInvoiceHistoricalReview";
import GetSystemBillingSettingsService from "../SystemSettingService/GetSystemBillingSettingsService";
import { getCompanyEffectivePlanValue } from "../../helpers/getCompanyEffectivePlanValue";
import { getRecurrenceMonths, normalizeRecurrence } from "../../helpers/recurrenceMonths";
import {
  instantToDomainDate,
  resolveSaasTimezone,
  toDomainDate,
  todayDomainDate
} from "../../helpers/saasDueDate";
import {
  BlockKind,
  evaluateCompanyBilling,
  FinancialStatus,
  loadLastBlockActions
} from "./billingEvaluation";
import { planSubscriptionRenewal } from "./applySubscriptionRenewal";
import {
  countHistoricalReviewPending,
  isHistoricalCandidate
} from "./HistoricalReviewService";

export type SubscriptionCenter = {
  company: { id: number; name: string; timezone: string };
  plan: { id: number; name: string } | null;
  recurrence: string | null;
  months: number | null;
  contractedValue: number;
  currentDueDate: string | null;
  nextCycleDueDate: string | null;
  status: {
    operational: "ativa" | "bloqueada";
    blockKind: BlockKind;
    financial: FinancialStatus;
    subscription: "em_dia" | "vencida" | "sem_vencimento";
    daysLate: number | null;
    daysUntilDue: number | null;
  };
  lastConfirmedPayment: {
    id: number;
    invoiceId: number | null;
    amount: number;
    paidAt: string | null;
    paidAtUnknown: boolean;
    method: string | null;
    source: string;
  } | null;
  nextExpectedCharge: {
    invoiceId: number;
    value: number;
    dueDate: string | null;
    isHistoricalCandidate: boolean;
  } | null;
  pendencies: {
    openInvoices: number;
    overdueInvoices: number;
    openAmount: number;
    reconciliationPending: number;
    historicalReviewPending: number;
  };
};

function isOpenStatus(status: unknown): boolean {
  const s = String(status || "").toLowerCase();
  return s !== "paid" && s !== "cancelled";
}

function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Assinatura: só olha o vencimento (não o bloqueio). Vence hoje ainda está em dia. */
export function resolveSubscriptionStatus(
  financial: FinancialStatus
): "em_dia" | "vencida" | "sem_vencimento" {
  if (financial === "sem_vencimento") return "sem_vencimento";
  if (financial === "carencia" || financial === "vencido") return "vencida";
  return "em_dia";
}

export async function getSubscriptionCenter(
  companyId: number,
  opts: { today?: string } = {}
): Promise<SubscriptionCenter> {
  const company = await Company.findByPk(companyId, {
    include: [{ model: Plan, as: "plan" }]
  });
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const tz = resolveSaasTimezone(company.timezone);
  const today = opts.today || todayDomainDate(tz);

  const [settings, lastBlockActions] = await Promise.all([
    GetSystemBillingSettingsService(),
    loadLastBlockActions([company.id])
  ]);
  const lastBlockAction = lastBlockActions.get(company.id) ?? null;

  const evaluation = evaluateCompanyBilling({
    company: {
      id: company.id,
      dueDate: company.dueDate as any,
      status: company.status !== false,
      timezone: tz
    },
    lastBlockAction,
    settings: {
      daysBeforeDueWarning: settings.daysBeforeDueWarning,
      daysAfterDueWarning: settings.daysAfterDueWarning,
      daysAfterDueBlock: settings.daysAfterDueBlock,
      enableAutoBlock: settings.enableAutoBlock,
      enableAutoWarning: settings.enableAutoWarning
    },
    today
  });

  // Mesma normalização do motor de renovação (vazio → MENSAL); recorrência desconhecida → months null.
  const recurrenceRaw = normalizeRecurrence(company.recurrence);
  const months = getRecurrenceMonths(recurrenceRaw);

  // Próximo ciclo = mesma regra da renovação (planejador único). Recorrência inválida → null.
  const plan = planSubscriptionRenewal({
    company: {
      id: company.id,
      dueDate: company.dueDate as any,
      recurrence: company.recurrence,
      timezone: tz,
      status: company.status !== false
    },
    reason: "payment_confirmed",
    lastBlockAction,
    today
  });
  const nextCycleDueDate = plan.error ? null : plan.newDueDate;

  // Último pagamento que conta como receita (cortesia nunca). Data desconhecida (histórico) vai por último.
  const lastPayment = await SaaSPayment.findOne({
    where: { companyId: company.id, countsAsRevenue: true },
    order: [
      ["paidAt", "DESC NULLS LAST"],
      ["id", "DESC"]
    ]
  });

  const [openInvoiceRows, reconciliationPending, historicalReviewPending] =
    await Promise.all([
      Invoices.findAll({
        where: {
          companyId: company.id,
          status: { [Op.notIn]: ["paid", "cancelled", "PAID", "CANCELLED"] }
        },
        order: [["id", "ASC"]]
      }),
      SaaSReconciliationItem.count({
        where: { companyId: company.id, status: "pending" }
      }),
      countHistoricalReviewPending(company.id)
    ]);
  const openInvoices = openInvoiceRows.filter(inv => isOpenStatus(inv.status));

  // Pagamentos/decisões terminais (para classificar candidatas com a regra completa de C5).
  const openIds = openInvoices.map(inv => inv.id);
  const [paidRows, terminalRows] = openIds.length
    ? await Promise.all([
        SaaSPayment.findAll({
          where: { companyId: company.id, invoiceId: { [Op.in]: openIds } },
          attributes: ["invoiceId"]
        }),
        SaaSInvoiceHistoricalReview.findAll({
          where: {
            invoiceId: { [Op.in]: openIds },
            decision: { [Op.ne]: "keep_pending" }
          },
          attributes: ["invoiceId"]
        })
      ])
    : [[], []];
  const withPayment = new Set(paidRows.map(p => Number(p.invoiceId)));
  const withTerminal = new Set(terminalRows.map(r => Number((r as any).invoiceId)));

  let openAmount = 0;
  let overdueInvoices = 0;
  const charges = openInvoices.map(inv => {
    const dueDate = toDomainDate(inv.dueDate as any, tz);
    const value = Number(inv.value) || 0;
    openAmount += value;
    if (dueDate && dueDate < today) overdueInvoices += 1;
    return {
      invoiceId: inv.id,
      value: roundMoney(value),
      dueDate,
      isHistoricalCandidate: isHistoricalCandidate(
        {
          status: inv.status,
          createdAt: inv.createdAt,
          legacyUnknown: inv.legacyUnknown,
          cycleKey: inv.cycleKey,
          paymentsCount: withPayment.has(inv.id) ? 1 : 0,
          hasTerminalReview: withTerminal.has(inv.id)
        },
        { timezone: tz }
      )
    };
  });

  // Próxima cobrança esperada: fatura em aberto com vencimento mais antigo, priorizando as que NÃO
  // são candidatas históricas (estas vão para a regularização). Sem vencimento legível vai por último.
  const byDue = (a: { dueDate: string | null }, b: { dueDate: string | null }) =>
    (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31");
  const current = charges.filter(c => !c.isHistoricalCandidate).sort(byDue);
  const historical = charges.filter(c => c.isHistoricalCandidate).sort(byDue);
  const nextExpectedCharge = current[0] || historical[0] || null;

  const paidAtUnknown =
    !!lastPayment &&
    (lastPayment.paidAt === null ||
      lastPayment.paidAt === undefined ||
      (lastPayment.metadata as any)?.paidAtUnknown === true);

  return {
    company: { id: company.id, name: company.name, timezone: tz },
    plan: company.plan ? { id: company.plan.id, name: company.plan.name } : null,
    recurrence: recurrenceRaw,
    months,
    contractedValue: getCompanyEffectivePlanValue({
      contractedPlanValue: (company as any).contractedPlanValue,
      plan: company.plan
    }),
    currentDueDate: evaluation.dueDate,
    nextCycleDueDate,
    status: {
      operational: evaluation.operationalStatus,
      blockKind: evaluation.blockKind,
      financial: evaluation.financialStatus,
      subscription: resolveSubscriptionStatus(evaluation.financialStatus),
      daysLate: evaluation.daysLate,
      daysUntilDue: evaluation.daysUntilDue
    },
    lastConfirmedPayment: lastPayment
      ? {
          id: lastPayment.id,
          invoiceId: lastPayment.invoiceId ?? null,
          amount: roundMoney(Number(lastPayment.amount) || 0),
          paidAt: paidAtUnknown ? null : instantToDomainDate(lastPayment.paidAt as any, tz),
          paidAtUnknown,
          method: lastPayment.method ?? null,
          source: lastPayment.source
        }
      : null,
    nextExpectedCharge,
    pendencies: {
      openInvoices: openInvoices.length,
      overdueInvoices,
      openAmount: roundMoney(openAmount),
      reconciliationPending,
      historicalReviewPending
    }
  };
}
