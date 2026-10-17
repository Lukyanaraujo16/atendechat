import moment from "moment-timezone";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import GetSystemBillingSettingsService, {
  SystemBillingSettings
} from "../SystemSettingService/GetSystemBillingSettingsService";
import { createCompanyLog } from "./CreateCompanyLogService";
import { hasCompanyBillingWarningLog } from "./BillingAutomationDedupeService";
import { dispatchBillingAutomationEvent } from "./billingAutomationHooks";
import { logger } from "../../utils/logger";
import {
  notifySuperAdminsBillingAutoBlock,
  notifySuperAdminsBillingOverdue,
  notifySuperAdminsBillingWarningBefore
} from "./notifySuperAdminsBilling";
import { getCompanyEffectivePlanValue } from "../../helpers/getCompanyEffectivePlanValue";
import { formatBillingAmountBrl } from "./billingWhatsAppTemplates";
import {
  evaluateCompanyBilling,
  resolveBillingJobMode
} from "../SaasBilling/billingEvaluation";

/**
 * Fase 8.4-F — modo do job (DECISOES D10/D15):
 * - "legacy" (default): comportamento histórico INALTERADO — só processa `dueDate` string `YYYY-MM-DD`;
 *   como `Companies.dueDate` é timestamptz e chega como `Date`, na prática pula as empresas.
 * - "normalized" (`BILLING_AUTOMATION_NORMALIZED_DATES=true|1`): normaliza o vencimento com o motor C1
 *   (`toDomainDate` no fuso da empresa) e aplica as mesmas regras de aviso/bloqueio.
 * A flag é lida a cada execução. Settings, defaults e agendamento não mudam.
 */
type JobPlan = {
  dueRaw: string;
  currentDateStr: string;
  daysUntilDue: number;
  daysLate: number;
  warnBefore: boolean;
  warnAfter: boolean;
  block: boolean;
};

type JobSettings = SystemBillingSettings;

/** Caminho legado — idêntico ao código anterior à 8.4-F. null = pular empresa. */
function planLegacy(company: Company, settings: JobSettings): JobPlan | null {
  if (!company.dueDate || typeof company.dueDate !== "string") return null;
  const dueRaw = company.dueDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) return null;

  const tzRaw = company.timezone?.trim();
  const tz = tzRaw && moment.tz.zone(tzRaw) ? tzRaw : "America/Sao_Paulo";

  const today = moment.tz(tz).startOf("day");
  const due = moment.tz(dueRaw, "YYYY-MM-DD", tz).startOf("day");
  if (!due.isValid()) return null;

  const daysUntilDue = due.diff(today, "days");
  const daysLate = today.diff(due, "days");
  return {
    dueRaw,
    currentDateStr: today.format("YYYY-MM-DD"),
    daysUntilDue,
    daysLate,
    warnBefore:
      settings.enableAutoWarning &&
      daysUntilDue === settings.daysBeforeDueWarning,
    warnAfter:
      settings.enableAutoWarning && daysLate === settings.daysAfterDueWarning,
    block: settings.enableAutoBlock && daysLate >= settings.daysAfterDueBlock
  };
}

/** Caminho normalizado — motor C1 (aceita Date/ISO/YYYY-MM-DD). null = pular empresa. */
function planNormalized(
  company: Company,
  settings: JobSettings
): JobPlan | null {
  const evaluation = evaluateCompanyBilling({
    company: {
      id: company.id,
      dueDate: company.dueDate as unknown as Date | string | null,
      status: company.status === true,
      timezone: company.timezone
    },
    settings
  });
  if (!evaluation.dueDate) return null;
  return {
    dueRaw: evaluation.dueDate,
    currentDateStr: evaluation.today,
    daysUntilDue: evaluation.daysUntilDue ?? 0,
    daysLate: evaluation.daysLate ?? 0,
    warnBefore: evaluation.wouldWarnBeforeDue,
    warnAfter: evaluation.wouldWarnAfterDue,
    block: evaluation.wouldBlock
  };
}

/**
 * Avalia empresas ativas com dueDate, regista avisos (uma vez por vencimento) e bloqueia após atraso configurável.
 */
export async function runBillingAutomationJob(): Promise<void> {
  const settings = await GetSystemBillingSettingsService();

  const companies = await Company.findAll({
    where: { status: true },
    attributes: [
      "id",
      "dueDate",
      "status",
      "timezone",
      "name",
      "phone",
      "contractedPlanValue",
      "planId"
    ],
    include: [{ model: Plan, as: "plan", attributes: ["value"], required: false }]
  });

  const jobMode = resolveBillingJobMode();

  for (const company of companies) {
    try {
      const plan =
        jobMode === "normalized"
          ? planNormalized(company, settings)
          : planLegacy(company, settings);
      if (!plan) continue;
      const { dueRaw, currentDateStr, daysUntilDue, daysLate } = plan;

      const effectiveAmount = getCompanyEffectivePlanValue({
        contractedPlanValue: company.contractedPlanValue,
        plan: company.plan
      });
      const amountBrl = formatBillingAmountBrl(effectiveAmount);

      if (plan.warnBefore || plan.warnAfter) {
        if (plan.warnBefore) {
          const exists = await hasCompanyBillingWarningLog(
            company.id,
            "warning_before_due",
            dueRaw
          );
          if (!exists) {
            const logId = await createCompanyLog({
              companyId: company.id,
              action: "warning_before_due",
              userId: null,
              metadata: {
                dueDate: dueRaw,
                currentDate: currentDateStr,
                daysUntilDue,
                kind: "automated",
                effectiveAmount,
                amountBrl
              }
            });
            await dispatchBillingAutomationEvent({
              type: "warning_before_due",
              companyId: company.id,
              dueDate: dueRaw,
              currentDate: currentDateStr,
              daysUntilDue,
              logId
            });
            try {
              await notifySuperAdminsBillingWarningBefore(company, dueRaw);
            } catch (e) {
              logger.warn(
                { err: e, companyId: company.id },
                "[UserNotification] billing_notify_hook_failed"
              );
            }
          }
        }

        if (plan.warnAfter) {
          const exists = await hasCompanyBillingWarningLog(
            company.id,
            "warning_after_due",
            dueRaw
          );
          if (!exists) {
            const logId = await createCompanyLog({
              companyId: company.id,
              action: "warning_after_due",
              userId: null,
              metadata: {
                dueDate: dueRaw,
                currentDate: currentDateStr,
                daysLate,
                kind: "automated",
                effectiveAmount,
                amountBrl
              }
            });
            await dispatchBillingAutomationEvent({
              type: "warning_after_due",
              companyId: company.id,
              dueDate: dueRaw,
              currentDate: currentDateStr,
              daysLate,
              logId
            });
            try {
              await notifySuperAdminsBillingOverdue(company, dueRaw);
            } catch (e) {
              logger.warn(
                { err: e, companyId: company.id },
                "[UserNotification] billing_notify_hook_failed"
              );
            }
          }
        }
      }

      if (plan.block) {
        const [affected] = await Company.update(
          { status: false },
          { where: { id: company.id, status: true } }
        );
        if (affected > 0) {
          const logId = await createCompanyLog({
            companyId: company.id,
            action: "auto_block",
            userId: null,
            metadata: {
              dueDate: dueRaw,
              currentDate: currentDateStr,
              daysLate,
              kind: "automated"
            }
          });
          await dispatchBillingAutomationEvent({
            type: "auto_block",
            companyId: company.id,
            dueDate: dueRaw,
            currentDate: currentDateStr,
            daysLate,
            logId
          });
          try {
            await notifySuperAdminsBillingAutoBlock(company, dueRaw);
          } catch (e) {
            logger.warn(
              { err: e, companyId: company.id },
              "[UserNotification] billing_notify_hook_failed"
            );
          }
        }
      }
    } catch (err) {
      logger.warn({ err, companyId: company.id }, "BillingAutomationJob row failed");
    }
  }
}
