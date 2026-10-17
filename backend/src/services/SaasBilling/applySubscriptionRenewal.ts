import { Op, Transaction } from "sequelize";
import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import CompanyLog from "../../models/CompanyLog";
import Invoices from "../../models/Invoices";
import SaaSSubscriptionRenewal from "../../models/SaaSSubscriptionRenewal";
import sequelize from "../../database";
import { computeInvoiceCoverageEnd, computeNextDueDate } from "./computeNextDueDate";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { BLOCK_LOG_ACTIONS, BlockKind, resolveBlockKind } from "./billingEvaluation";
import { createCompanyLog } from "../CompanyService/CreateCompanyLogService";
import { logger } from "../../utils/logger";
import {
  resolveSaasTimezone,
  toDomainDate,
  todayDomainDate
} from "../../helpers/saasDueDate";
import {
  notifySuperAdminsBillingReactivated,
  notifySuperAdminsBillingRenewal
} from "../CompanyService/notifySuperAdminsBilling";

export type RenewalReason =
  | "payment_confirmed"
  | "manual_renew"
  | "courtesy"
  | "due_date_adjustment";

/** Janela anti-duplo-clique quando o cliente não envia expectedCurrentDueDate. */
const MANUAL_RENEW_GUARD_SECONDS = 30;

export type ApplySubscriptionRenewalInput = {
  companyId: number;
  reason: RenewalReason;
  actorUserId?: number | null;
  invoiceId?: number | null;
  paymentId?: number | null;
  /** Para due_date_adjustment: data explícita (YYYY-MM-DD). */
  explicitDueDate?: string | null;
  idempotencyKey?: string | null;
  /** Não estende dueDate (ex.: cortesia sem renovação de ciclo). */
  skipDueDateExtension?: boolean;
  /**
   * Vencimento que o administrador viu na tela (YYYY-MM-DD ou null).
   * Se informado e diferente do atual → ERR_RENEWAL_STALE (clique duplo / concorrência).
   */
  expectedCurrentDueDate?: string | null;
  /**
   * Vencimento da fatura paga: se o período dela já está coberto pelo vencimento atual
   * (ex.: renovação administrativa anterior), não estende de novo.
   */
  coversInvoiceDueDate?: Date | string | null;
  /** Justificativa registrada na auditoria. */
  note?: string | null;
  transaction?: Transaction;
};

export type RenewalSkippedReason = "period_already_covered" | null;

export type ApplySubscriptionRenewalResult = {
  company: Company;
  renewal: SaaSSubscriptionRenewal | null;
  autoUnblocked: boolean;
  alreadyApplied: boolean;
  skippedReason: RenewalSkippedReason;
  previousDueDate: string | null;
};

export type RenewalAlert = { code: string; message: string };

export type RenewalPlanAction =
  /** Estende o vencimento (cria SaaSSubscriptionRenewal). */
  | "renew"
  /** skipDueDateExtension: só registra o evento, não estende. */
  | "skip_extension"
  /** Período da fatura já coberto pelo vencimento atual (D4). */
  | "period_already_covered";

export type PlanSubscriptionRenewalInput = {
  company: {
    id: number;
    dueDate: Date | string | null;
    recurrence?: string | null;
    timezone?: string | null;
    status: boolean;
  };
  reason: RenewalReason;
  explicitDueDate?: string | null;
  skipDueDateExtension?: boolean;
  /** `undefined` = não informado (não valida). */
  expectedCurrentDueDate?: string | null;
  /** `undefined` = renovação não vinculada a fatura. */
  coversInvoiceDueDate?: Date | string | null;
  /** Último CompanyLog de bloqueio/desbloqueio (block|unblock|auto_block|auto_unblock_after_renew). */
  lastBlockAction?: string | null;
  /** Hoje (YYYY-MM-DD) — testes; padrão: hoje no fuso da empresa. */
  today?: string;
};

export type SubscriptionRenewalPlan = {
  action: RenewalPlanAction;
  previousDueDate: string | null;
  /** Novo vencimento (só quando action = "renew" e sem erro). */
  newDueDate: string | null;
  months: number;
  recurrence: string;
  overdue: boolean;
  cyclesSkipped: number;
  /** Fim do período coberto pela fatura (quando aplicável). */
  invoiceCoverageEnd: string | null;
  /** expectedCurrentDueDate informado e diferente do vencimento atual. */
  stale: boolean;
  wasBlocked: boolean;
  blockKind: BlockKind;
  willUnblock: boolean;
  /** Bloqueio manual mantido porque a renovação vem de pagamento/cortesia (D6). */
  unblockSkippedManual: boolean;
  /** Erro de cálculo (recorrência inválida, data de ajuste inválida) — a execução lança este erro. */
  error: { code: string; statusCode: number; message: string } | null;
  alerts: RenewalAlert[];
};

/**
 * Planejamento PURO da renovação (sem I/O): a MESMA regra para prévias e execução (F-D1).
 * A execução chama esta função com o estado lido sob lock; as prévias, com o estado atual.
 */
export function planSubscriptionRenewal(
  input: PlanSubscriptionRenewalInput
): SubscriptionRenewalPlan {
  const { company } = input;
  const tz = resolveSaasTimezone(company.timezone);
  const today = input.today || todayDomainDate(tz);
  const previousDueDate = toDomainDate(company.dueDate, tz);
  const wasBlocked = company.status === false;
  const blockKind = resolveBlockKind(company.status !== false, input.lastBlockAction);
  const stale =
    input.expectedCurrentDueDate !== undefined &&
    (toDomainDate(input.expectedCurrentDueDate, tz) || null) !== previousDueDate;
  const isPaymentReason =
    input.reason === "payment_confirmed" || input.reason === "courtesy";

  const plan: SubscriptionRenewalPlan = {
    action: "renew",
    previousDueDate,
    newDueDate: null,
    months: 0,
    recurrence: String(company.recurrence || "MENSAL").toUpperCase(),
    overdue: !!previousDueDate && previousDueDate < today,
    cyclesSkipped: 0,
    invoiceCoverageEnd: null,
    stale,
    wasBlocked,
    blockKind,
    willUnblock: false,
    unblockSkippedManual: false,
    error: null,
    alerts: []
  };

  const alertManualBlockKept = (): void => {
    if (wasBlocked && blockKind === "manual" && isPaymentReason) {
      plan.alerts.push({
        code: "MANUAL_BLOCK_KEEPS_BLOCKED",
        message:
          "A empresa está bloqueada manualmente: o pagamento não desfaz o bloqueio. Desbloqueie manualmente se for o caso."
      });
    }
  };

  if (input.skipDueDateExtension) {
    plan.action = "skip_extension";
    alertManualBlockKept();
    return plan;
  }

  if (input.coversInvoiceDueDate !== undefined) {
    plan.invoiceCoverageEnd = computeInvoiceCoverageEnd(
      input.coversInvoiceDueDate,
      company.recurrence,
      tz
    );
    if (
      previousDueDate &&
      plan.invoiceCoverageEnd &&
      previousDueDate >= plan.invoiceCoverageEnd
    ) {
      plan.action = "period_already_covered";
      plan.alerts.push({
        code: "PERIOD_ALREADY_COVERED",
        message: `O vencimento atual (${previousDueDate}) já cobre o período desta fatura (até ${plan.invoiceCoverageEnd}): o pagamento será registrado sem estender o vencimento.`
      });
      alertManualBlockKept();
      return plan;
    }
  }

  if (input.reason === "due_date_adjustment") {
    const explicit = /^\d{4}-\d{2}-\d{2}$/.test(String(input.explicitDueDate || ""))
      ? toDomainDate(input.explicitDueDate, tz)
      : null;
    if (!explicit) {
      plan.error = {
        code: "ERR_INVALID_DUE_DATE",
        statusCode: 400,
        message: "Informe o novo vencimento no formato AAAA-MM-DD."
      };
      return plan;
    }
    plan.newDueDate = explicit;
  } else {
    try {
      const computed = computeNextDueDate({
        currentDueDate: previousDueDate,
        recurrence: company.recurrence,
        timezone: tz,
        today
      });
      plan.newDueDate = computed.newDueDate;
      plan.months = computed.months;
      plan.recurrence = computed.recurrence;
      plan.cyclesSkipped = computed.cyclesSkipped;
      plan.overdue = computed.overdue;
    } catch (err: any) {
      plan.error = {
        code: err?.message || "ERR_INVALID_RECURRENCE",
        statusCode: err?.statusCode || 400,
        message:
          err?.clientMessage ||
          "Defina a recorrência da empresa (MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL)."
      };
      return plan;
    }
  }

  if (plan.cyclesSkipped > 0) {
    plan.alerts.push({
      code: "CYCLES_SKIPPED",
      message: `${plan.cyclesSkipped} ciclo(s) vencido(s) ficarão para trás sem cobrança automática; faturas abertas desses ciclos continuam abertas.`
    });
  }

  const newDueIsCurrent = !!plan.newDueDate && plan.newDueDate >= today;
  plan.willUnblock = wasBlocked && newDueIsCurrent;
  // D6: bloqueio manual (não financeiro) não é desfeito por pagamento/cortesia.
  if (plan.willUnblock && isPaymentReason && blockKind === "manual") {
    plan.willUnblock = false;
    plan.unblockSkippedManual = true;
  }
  alertManualBlockKept();
  if (wasBlocked && blockKind === "manual" && !isPaymentReason && plan.willUnblock) {
    plan.alerts.push({
      code: "MANUAL_BLOCK_WILL_BE_LIFTED",
      message:
        "A empresa está bloqueada manualmente e esta ação administrativa vai reativá-la."
    });
  }
  return plan;
}

export type SubscriptionRenewalPreview = {
  currentDueDate: string | null;
  recurrence: string;
  months: number;
  newDueDate: string;
  overdue: boolean;
  cyclesSkipped: number;
  /** Fase 8.4-F (campos aditivos, compatíveis). */
  willUnblock: boolean;
  blockKind: BlockKind;
  alerts: RenewalAlert[];
  /** Enviar de volta em POST /companies/:id/renew (409 ERR_RENEWAL_STALE se mudou). */
  expectedCurrentDueDate: string | null;
};

/** Última ação de bloqueio/desbloqueio da empresa (mesma ordenação do motor C1). */
export async function loadLastBlockAction(
  companyId: number,
  t?: Transaction
): Promise<string | null> {
  const last = await CompanyLog.findOne({
    where: { companyId, action: { [Op.in]: [...BLOCK_LOG_ACTIONS] } },
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"]
    ],
    transaction: t
  });
  return last?.action ?? null;
}

/** Prévia da renovação administrativa (sem escrita) — mesmo planejador da execução. */
export async function previewSubscriptionRenewal(
  companyId: number
): Promise<SubscriptionRenewalPreview> {
  const company = await Company.findByPk(companyId);
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  const lastBlockAction =
    company.status === false ? await loadLastBlockAction(company.id) : null;
  const plan = planSubscriptionRenewal({
    company: company as any,
    reason: "manual_renew",
    lastBlockAction
  });
  if (plan.error) {
    throw new AppError(plan.error.code, plan.error.statusCode, plan.error.message);
  }
  const alerts = [...plan.alerts];
  const openInvoices = await Invoices.count({
    where: {
      companyId: company.id,
      status: { [Op.notIn]: ["paid", "cancelled"] }
    }
  });
  if (openInvoices > 0) {
    alerts.push({
      code: "OPEN_INVOICES_NOT_PAID",
      message: `A renovação administrativa não quita faturas nem registra pagamento: ${openInvoices} fatura(s) em aberto continuarão em aberto.`
    });
  }
  return {
    currentDueDate: plan.previousDueDate,
    recurrence: plan.recurrence,
    months: plan.months,
    newDueDate: plan.newDueDate as string,
    overdue: plan.overdue,
    cyclesSkipped: plan.cyclesSkipped,
    willUnblock: plan.willUnblock,
    blockKind: plan.blockKind,
    alerts,
    expectedCurrentDueDate: plan.previousDueDate
  };
}

/**
 * Motor único de renovação — idempotente por idempotencyKey.
 * Cortesia/ajuste/manual_renew/payment compartilham o mesmo planejamento (planSubscriptionRenewal).
 */
export async function applySubscriptionRenewal(
  input: ApplySubscriptionRenewalInput
): Promise<ApplySubscriptionRenewalResult> {
  const run = async (t: Transaction): Promise<ApplySubscriptionRenewalResult> => {
    // Lock da empresa ANTES de checar idempotência: chamadas concorrentes serializam aqui
    // e a segunda enxerga a renovação já commitada (evita violação de unique em transação abortada).
    const company = await Company.findByPk(input.companyId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

    const tz = resolveSaasTimezone(company.timezone);
    const previousDueDate = toDomainDate(company.dueDate, tz);

    if (input.idempotencyKey) {
      const existing = await SaaSSubscriptionRenewal.findOne({
        where: { idempotencyKey: input.idempotencyKey },
        transaction: t
      });
      if (existing) {
        return {
          company,
          renewal: existing,
          autoUnblocked: false,
          alreadyApplied: true,
          skippedReason: null,
          previousDueDate
        };
      }
    }

    // Só consulta o histórico de bloqueio quando a empresa está bloqueada (único caso em que importa).
    const lastBlockAction =
      company.status === false ? await loadLastBlockAction(company.id, t) : null;

    const plan = planSubscriptionRenewal({
      company: company as any,
      reason: input.reason,
      explicitDueDate: input.explicitDueDate,
      skipDueDateExtension: input.skipDueDateExtension,
      expectedCurrentDueDate: input.expectedCurrentDueDate,
      coversInvoiceDueDate: input.coversInvoiceDueDate,
      lastBlockAction
    });

    if (plan.stale) {
      throw new AppError(
        "ERR_RENEWAL_STALE",
        409,
        "O vencimento desta empresa já foi alterado. Recarregue a página antes de renovar novamente."
      );
    }

    if (input.reason === "manual_renew" && input.expectedCurrentDueDate === undefined) {
      const recent = await SaaSSubscriptionRenewal.findOne({
        where: {
          companyId: company.id,
          reason: "manual_renew",
          createdAt: {
            [Op.gte]: moment().subtract(MANUAL_RENEW_GUARD_SECONDS, "seconds").toDate()
          }
        },
        transaction: t
      });
      if (recent) {
        throw new AppError(
          "ERR_RENEWAL_TOO_SOON",
          409,
          "Esta empresa acabou de ser renovada. Recarregue a página para ver o novo vencimento."
        );
      }
    }

    if (plan.action === "skip_extension") {
      await recordFinancialEvent({
        companyId: company.id,
        invoiceId: input.invoiceId ?? null,
        paymentId: input.paymentId ?? null,
        eventType: `renewal_skipped_${input.reason}`,
        actorUserId: input.actorUserId ?? null,
        idempotencyKey: input.idempotencyKey
          ? `evt:${input.idempotencyKey}`
          : null,
        payload: { reason: input.reason },
        transaction: t
      });
      return {
        company,
        renewal: null,
        autoUnblocked: false,
        alreadyApplied: false,
        skippedReason: null,
        previousDueDate
      };
    }

    if (plan.action === "period_already_covered") {
      await recordFinancialEvent({
        companyId: company.id,
        invoiceId: input.invoiceId ?? null,
        paymentId: input.paymentId ?? null,
        eventType: "renewal_skipped_period_already_covered",
        actorUserId: input.actorUserId ?? null,
        idempotencyKey: input.idempotencyKey
          ? `evt-skip:${input.idempotencyKey}`
          : null,
        payload: {
          reason: input.reason,
          currentDueDate: previousDueDate,
          invoiceCoverageEnd: plan.invoiceCoverageEnd
        },
        transaction: t
      });
      return {
        company,
        renewal: null,
        autoUnblocked: false,
        alreadyApplied: false,
        skippedReason: "period_already_covered",
        previousDueDate
      };
    }

    if (plan.error) {
      throw new AppError(plan.error.code, plan.error.statusCode, plan.error.message);
    }

    const newDueDate = plan.newDueDate as string;
    const shouldUnblock = plan.willUnblock;

    await company.update(
      {
        dueDate: newDueDate,
        ...(shouldUnblock ? { status: true } : {})
      },
      { transaction: t }
    );

    let renewal: SaaSSubscriptionRenewal;
    try {
      renewal = await SaaSSubscriptionRenewal.create(
        {
          companyId: company.id,
          invoiceId: input.invoiceId ?? null,
          paymentId: input.paymentId ?? null,
          reason: input.reason,
          previousDueDate,
          newDueDate,
          recurrence: plan.recurrence,
          monthsAdded: plan.months,
          actorUserId: input.actorUserId ?? null,
          idempotencyKey: input.idempotencyKey ?? null
        },
        { transaction: t }
      );
    } catch (err: any) {
      if (
        input.idempotencyKey &&
        err?.name === "SequelizeUniqueConstraintError"
      ) {
        // A transação já está abortada no Postgres; não dá para reler aqui.
        throw new AppError(
          "ERR_RENEWAL_DUPLICATE",
          409,
          "Esta renovação já foi aplicada por outra operação simultânea."
        );
      }
      throw err;
    }

    await recordFinancialEvent({
      companyId: company.id,
      invoiceId: input.invoiceId ?? null,
      paymentId: input.paymentId ?? null,
      eventType: `renewal_${input.reason}`,
      actorUserId: input.actorUserId ?? null,
      idempotencyKey: input.idempotencyKey
        ? `evt-renew:${input.idempotencyKey}`
        : null,
      payload: {
        previousDueDate,
        newDueDate,
        months: plan.months,
        recurrence: plan.recurrence,
        cyclesSkipped: plan.cyclesSkipped,
        autoUnblocked: shouldUnblock,
        unblockSkippedManualBlock: plan.unblockSkippedManual,
        note: input.note ?? null
      },
      transaction: t
    });

    await company.reload({ transaction: t });
    return {
      company,
      renewal,
      autoUnblocked: shouldUnblock,
      alreadyApplied: false,
      skippedReason: null,
      previousDueDate
    };
  };

  const result = input.transaction
    ? await run(input.transaction)
    : await sequelize.transaction(run);

  // Efeitos fora da transação: só quando ela é nossa (o chamador que passa transaction ainda pode
  // fazer rollback). Com transaction externa o chamador decide (ver runRenewalSideEffects).
  if (!input.transaction) {
    await runRenewalSideEffects(input, result);
  }

  return result;
}

/** Auditoria (CompanyLog) e notificações pós-commit. Falhas não revertem a renovação. */
export async function runRenewalSideEffects(
  input: Pick<ApplySubscriptionRenewalInput, "reason" | "actorUserId" | "note">,
  result: ApplySubscriptionRenewalResult
): Promise<void> {
  if (result.alreadyApplied || !result.renewal) return;

  if (input.actorUserId != null) {
    try {
      await createCompanyLog({
        companyId: result.company.id,
        action: input.reason === "manual_renew" ? "renew" : `renew_${input.reason}`,
        userId: input.actorUserId,
        metadata: {
          previousDueDate: result.renewal.previousDueDate,
          newDueDate: result.renewal.newDueDate,
          reason: input.reason,
          note: input.note ?? null
        }
      });
      if (result.autoUnblocked) {
        await createCompanyLog({
          companyId: result.company.id,
          action: "auto_unblock_after_renew",
          userId: input.actorUserId,
          metadata: {
            previousDueDate: result.renewal.previousDueDate,
            newDueDate: result.renewal.newDueDate,
            kind: "automated_after_renew"
          }
        });
      }
    } catch (err) {
      logger.warn({ err }, "[SaasBilling] company_log_after_renew_failed");
    }
  }

  try {
    await notifySuperAdminsBillingRenewal(
      result.company,
      result.renewal.previousDueDate,
      result.renewal.newDueDate
    );
    if (result.autoUnblocked) {
      await notifySuperAdminsBillingReactivated(
        result.company,
        result.renewal.newDueDate
      );
    }
  } catch (err) {
    logger.warn({ err }, "[SaasBilling] notify_after_renew_failed");
  }
}
