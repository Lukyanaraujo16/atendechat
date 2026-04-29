import moment from "moment-timezone";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import GetSystemBillingSettingsService from "../SystemSettingService/GetSystemBillingSettingsService";
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

  for (const company of companies) {
    try {
      if (!company.dueDate || typeof company.dueDate !== "string") continue;
      const dueRaw = company.dueDate.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueRaw)) continue;

      const tzRaw = company.timezone?.trim();
      const tz =
        tzRaw && moment.tz.zone(tzRaw) ? tzRaw : "America/Sao_Paulo";

      const today = moment.tz(tz).startOf("day");
      const due = moment.tz(dueRaw, "YYYY-MM-DD", tz).startOf("day");
      if (!due.isValid()) continue;

      const currentDateStr = today.format("YYYY-MM-DD");
      const daysUntilDue = due.diff(today, "days");
      const daysLate = today.diff(due, "days");

      const effectiveAmount = getCompanyEffectivePlanValue({
        contractedPlanValue: company.contractedPlanValue,
        plan: company.plan
      });
      const amountBrl = formatBillingAmountBrl(effectiveAmount);

      if (settings.enableAutoWarning) {
        if (daysUntilDue === settings.daysBeforeDueWarning) {
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

        if (daysLate === settings.daysAfterDueWarning) {
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

      if (
        settings.enableAutoBlock &&
        daysLate >= settings.daysAfterDueBlock
      ) {
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
