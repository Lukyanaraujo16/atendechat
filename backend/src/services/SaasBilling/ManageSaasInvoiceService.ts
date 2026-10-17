import { Op, Transaction } from "sequelize";
import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import Invoices from "../../models/Invoices";
import SaaSPayment from "../../models/SaaSPayment";
import SaaSSubscriptionRenewal from "../../models/SaaSSubscriptionRenewal";
import sequelize from "../../database";
import { getCompanyEffectivePlanValue } from "../../helpers/getCompanyEffectivePlanValue";
import { resolveSaasTimezone, toDomainDate } from "../../helpers/saasDueDate";
import { resolvePlanIdForQuery } from "../PlanService/planIdResolve";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { applySubscriptionRenewal } from "./applySubscriptionRenewal";

/**
 * Fase 8.4 (Marco C) — gestão manual de faturas SaaS pelo Super Admin.
 * Nunca emite/altera cobrança na Efí: apenas registros locais + ledger.
 */

const DOMAIN_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COMPETENCE_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CYCLE_UNIQUE_INDEX = "invoices_company_cycle_unique";

export function isValidDomainDate(value: unknown): value is string {
  if (typeof value !== "string" || !DOMAIN_DATE_RE.test(value)) return false;
  return moment(value, "YYYY-MM-DD", true).isValid();
}

function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}

function parseMoney(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? roundMoney(n) : NaN;
}

function requireReason(reason: unknown): string {
  const r = typeof reason === "string" ? reason.trim() : "";
  if (r.length < 3) {
    throw new AppError(
      "ERR_INVOICE_REASON_REQUIRED",
      400,
      "Informe a justificativa (mínimo 3 caracteres)."
    );
  }
  return r;
}

function assertValidValue(value: number | null): asserts value is number {
  if (value === null || !Number.isFinite(value) || value <= 0) {
    throw new AppError(
      "ERR_INVALID_INVOICE_VALUE",
      400,
      "O valor da fatura deve ser maior que zero."
    );
  }
}

function duplicateError(existingId?: number | null, cycleKey?: string | null) {
  const ref = existingId ? `#${existingId}` : "existente";
  return new AppError(
    "ERR_INVOICE_CYCLE_DUPLICATE",
    409,
    `Já existe a fatura ${ref} não cancelada para o ciclo ${
      cycleKey || "informado"
    } desta empresa.`,
    existingId ? { existingInvoiceId: existingId } : undefined
  );
}

function isCycleUniqueViolation(err: any): boolean {
  if (err?.name !== "SequelizeUniqueConstraintError") return false;
  const constraint = String(
    err?.parent?.constraint || err?.original?.constraint || ""
  );
  if (constraint === CYCLE_UNIQUE_INDEX) return true;
  const fields = err?.fields;
  if (fields && typeof fields === "object") {
    return Object.prototype.hasOwnProperty.call(fields, "cycleKey");
  }
  return false;
}

/**
 * Recusa ciclo duplicado: mesma (companyId, cycleKey) não cancelada,
 * ou fatura legada (cycleKey nulo) não cancelada com o mesmo vencimento.
 */
async function assertNoCycleDuplicate(params: {
  companyId: number;
  cycleKey: string;
  dueDate: string;
  excludeInvoiceId?: number;
  transaction: Transaction;
}): Promise<void> {
  const { companyId, cycleKey, dueDate, excludeInvoiceId, transaction } =
    params;
  const idFilter = excludeInvoiceId
    ? { id: { [Op.ne]: excludeInvoiceId } }
    : {};

  // Sem FOR UPDATE de propósito: travar faturas aqui (empresa → fatura) inverteria a ordem usada por
  // baixa manual/gateway (fatura → empresa) e poderia causar deadlock. A criação já é serializada pelo
  // lock da empresa e o índice invoices_company_cycle_unique é a garantia final (tratado como 409).
  const sameCycle = await Invoices.findOne({
    where: {
      companyId,
      cycleKey,
      status: { [Op.ne]: "cancelled" },
      ...idFilter
    },
    transaction
  });
  if (sameCycle) throw duplicateError(sameCycle.id, cycleKey);

  const legacySameDue = await Invoices.findOne({
    where: {
      companyId,
      cycleKey: null,
      status: { [Op.ne]: "cancelled" },
      dueDate: { [Op.like]: `${dueDate}%` },
      ...idFilter
    },
    transaction
  });
  if (legacySameDue) throw duplicateError(legacySameDue.id, cycleKey);
}

export type CreateManualInvoiceInput = {
  companyId: number;
  actorUserId: number;
  dueDate: string;
  value?: number | string | null;
  competence?: string | null;
  detail?: string | null;
  reason: string;
};

export async function createManualInvoice(
  input: CreateManualInvoiceInput
): Promise<Invoices> {
  const reason = requireReason(input.reason);

  if (!isValidDomainDate(input.dueDate)) {
    throw new AppError(
      "ERR_INVALID_DUE_DATE",
      400,
      "Vencimento inválido (use YYYY-MM-DD)."
    );
  }
  const dueDate = input.dueDate;

  let competence = dueDate.slice(0, 7);
  if (input.competence !== undefined && input.competence !== null && input.competence !== "") {
    if (!COMPETENCE_RE.test(String(input.competence))) {
      throw new AppError(
        "ERR_INVALID_COMPETENCE",
        400,
        "Competência inválida (use YYYY-MM)."
      );
    }
    competence = String(input.competence);
  }
  const cycleKey = competence;

  const explicitValue = parseMoney(input.value);
  if (explicitValue !== null) assertValidValue(explicitValue);

  try {
    return await sequelize.transaction(async t => {
      // Lock na empresa serializa criações concorrentes para o mesmo tenant.
      const company = await Company.findByPk(input.companyId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

      const planId = resolvePlanIdForQuery(company.planId);
      const plan = planId != null ? await Plan.findByPk(planId, { transaction: t }) : null;
      if (!plan) {
        throw new AppError(
          "ERR_COMPANY_PLAN_NOT_FOUND",
          400,
          "Empresa sem plano válido; defina o plano antes de lançar faturas."
        );
      }

      const value =
        explicitValue !== null
          ? explicitValue
          : roundMoney(
              getCompanyEffectivePlanValue({
                contractedPlanValue: (company as any).contractedPlanValue,
                plan
              })
            );
      assertValidValue(value);

      await assertNoCycleDuplicate({
        companyId: company.id,
        cycleKey,
        dueDate,
        transaction: t
      });

      const detail =
        typeof input.detail === "string" && input.detail.trim()
          ? input.detail.trim()
          : plan.name;
      const recurrence = company.recurrence || "MENSAL";

      const invoice = await Invoices.create(
        {
          detail,
          status: "open",
          value,
          dueDate,
          companyId: company.id,
          competence,
          cycleKey,
          planIdSnapshot: plan.id,
          planNameSnapshot: plan.name,
          recurrenceSnapshot: recurrence,
          paymentSource: null,
          legacyUnknown: false,
          gatewaySyncStatus: "none"
        } as any,
        { transaction: t }
      );

      await recordFinancialEvent({
        companyId: company.id,
        invoiceId: invoice.id,
        eventType: "invoice_created_manual",
        actorUserId: input.actorUserId,
        payload: {
          reason,
          dueDate,
          competence,
          cycleKey,
          value,
          valueSource: explicitValue !== null ? "explicit" : "plan",
          detail,
          planId: plan.id,
          planName: plan.name,
          recurrence
        },
        transaction: t
      });

      return invoice;
    });
  } catch (err: any) {
    if (isCycleUniqueViolation(err)) throw duplicateError(null, cycleKey);
    throw err;
  }
}

export type UpdateOpenInvoiceInput = {
  companyId: number;
  invoiceId: number;
  actorUserId: number;
  value?: number | string | null;
  dueDate?: string | null;
  detail?: string | null;
  reason: string;
};

function notEditable(message: string) {
  return new AppError("ERR_INVOICE_NOT_EDITABLE", 409, message);
}

export async function updateOpenInvoice(
  input: UpdateOpenInvoiceInput
): Promise<Invoices> {
  const reason = requireReason(input.reason);

  const newValue = parseMoney(input.value);
  if (newValue !== null) assertValidValue(newValue);

  const hasDueDate =
    input.dueDate !== undefined && input.dueDate !== null && input.dueDate !== "";
  if (hasDueDate && !isValidDomainDate(input.dueDate)) {
    throw new AppError(
      "ERR_INVALID_DUE_DATE",
      400,
      "Vencimento inválido (use YYYY-MM-DD)."
    );
  }
  const hasDetail = typeof input.detail === "string";

  let attemptedCycleKey: string | null = null;

  try {
    return await sequelize.transaction(async t => {
      const invoice = await Invoices.findOne({
        where: { id: input.invoiceId, companyId: input.companyId },
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!invoice) throw new AppError("ERR_INVOICE_NOT_FOUND", 404);

      if (String(invoice.status).toLowerCase() !== "open") {
        throw notEditable("Somente faturas em aberto podem ser editadas.");
      }
      if (invoice.externalTxid || invoice.externalChargeId) {
        throw notEditable(
          "Fatura com cobrança externa ativa (Efí) não pode ser editada."
        );
      }
      const paymentsCount = await SaaSPayment.count({
        where: { invoiceId: invoice.id, companyId: input.companyId },
        transaction: t
      });
      if (paymentsCount > 0) {
        throw notEditable("Fatura com pagamento registrado não pode ser editada.");
      }

      const company = await Company.findByPk(input.companyId, {
        attributes: ["id", "timezone"],
        transaction: t
      });
      const tz = resolveSaasTimezone(company?.timezone);

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const changes: Record<string, unknown> = {};

      if (newValue !== null && roundMoney(Number(invoice.value)) !== newValue) {
        before.value = Number(invoice.value);
        after.value = newValue;
        changes.value = newValue;
      }

      if (hasDetail) {
        // Vazio limpa a descrição (coluna nullable) — antes era ignorado e a tela dizia "salvo".
        const nextDetail = String(input.detail ?? "").trim() || null;
        if (nextDetail !== ((invoice.detail || "").trim() || null)) {
          before.detail = invoice.detail ?? null;
          after.detail = nextDetail;
          changes.detail = nextDetail;
        }
      }

      if (hasDueDate) {
        const nextDue = String(input.dueDate);
        const currentDue = toDomainDate(invoice.dueDate as any, tz);
        if (nextDue !== currentDue) {
          before.dueDate = currentDue;
          after.dueDate = nextDue;
          changes.dueDate = nextDue;

          // Só reclassifica ciclo de faturas já vinculadas a ciclo (não legadas).
          if (invoice.cycleKey) {
            const nextCycle = nextDue.slice(0, 7);
            if (nextCycle !== invoice.cycleKey) {
              attemptedCycleKey = nextCycle;
              await assertNoCycleDuplicate({
                companyId: input.companyId,
                cycleKey: nextCycle,
                dueDate: nextDue,
                excludeInvoiceId: invoice.id,
                transaction: t
              });
              before.cycleKey = invoice.cycleKey;
              before.competence = invoice.competence ?? null;
              after.cycleKey = nextCycle;
              after.competence = nextCycle;
              changes.cycleKey = nextCycle;
              changes.competence = nextCycle;
            }
          }
        }
      }

      if (!Object.keys(changes).length) {
        return invoice;
      }

      await invoice.update(changes, { transaction: t });

      await recordFinancialEvent({
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        eventType: "invoice_updated",
        actorUserId: input.actorUserId,
        payload: {
          reason,
          changedFields: Object.keys(changes),
          before,
          after
        },
        transaction: t
      });

      await invoice.reload({ transaction: t });
      return invoice;
    });
  } catch (err: any) {
    if (isCycleUniqueViolation(err)) {
      throw duplicateError(null, attemptedCycleKey);
    }
    throw err;
  }
}

export type AdjustCompanyDueDateInput = {
  companyId: number;
  actorUserId: number;
  dueDate: string;
  reason: string;
};

/**
 * Ajuste administrativo de vencimento (motor de renovação do P0 com reason
 * "due_date_adjustment"). Chave de idempotência determinística a partir do estado
 * atual: clique duplo/concorrência viram o mesmo ajuste; o id da última renovação
 * diferencia ajustes legítimos repetidos (A→B, B→A, A→B).
 */
export async function adjustCompanyDueDate(input: AdjustCompanyDueDateInput) {
  const reason = requireReason(input.reason);
  if (!isValidDomainDate(input.dueDate)) {
    throw new AppError(
      "ERR_INVALID_DUE_DATE",
      400,
      "Vencimento inválido (use YYYY-MM-DD)."
    );
  }

  const company = await Company.findByPk(input.companyId);
  if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

  const tz = resolveSaasTimezone(company.timezone);
  const previousDueDate = toDomainDate(company.dueDate as any, tz);

  if (previousDueDate === input.dueDate) {
    return { company, renewal: null, alreadyApplied: true, reason };
  }

  const lastRenewal = await SaaSSubscriptionRenewal.findOne({
    where: { companyId: input.companyId },
    order: [["id", "DESC"]],
    attributes: ["id"]
  });
  const idempotencyKey = `adj:${input.companyId}:${
    previousDueDate || "none"
  }:${input.dueDate}:r${lastRenewal?.id ?? 0}`;

  // Sem transaction externa: o motor faz commit e roda auditoria/notificações pós-commit.
  // `note` vai para o ledger (renewal_due_date_adjustment) e para o CompanyLog.
  // `expectedCurrentDueDate` protege contra alteração concorrente entre a leitura e o lock.
  const result = await applySubscriptionRenewal({
    companyId: input.companyId,
    reason: "due_date_adjustment",
    actorUserId: input.actorUserId,
    explicitDueDate: input.dueDate,
    expectedCurrentDueDate: previousDueDate,
    idempotencyKey,
    note: reason
  });

  return {
    company: result.company,
    renewal: result.renewal,
    alreadyApplied: result.alreadyApplied,
    reason
  };
}
