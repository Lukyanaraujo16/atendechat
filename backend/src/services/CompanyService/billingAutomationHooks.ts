import moment from "moment";
import Company from "../../models/Company";
import CompanyLog from "../../models/CompanyLog";
import GetSystemBillingSettingsService from "../SystemSettingService/GetSystemBillingSettingsService";
import { logger } from "../../utils/logger";
import {
  templateWarningAfterDue,
  templateWarningBeforeDue
} from "./billingWhatsAppTemplates";
import { trySendBillingWhatsAppWarning } from "./SendBillingWhatsAppWarningService";
import { notifySuperAdminsBillingWhatsAppFailed } from "./notifySuperAdminsBilling";

export type BillingAutomationHookEvent =
  | {
      type: "warning_before_due";
      companyId: number;
      dueDate: string;
      currentDate: string;
      daysUntilDue: number;
      logId: number | null;
    }
  | {
      type: "warning_after_due";
      companyId: number;
      dueDate: string;
      currentDate: string;
      daysLate: number;
      logId: number | null;
    }
  | {
      type: "auto_block";
      companyId: number;
      dueDate: string;
      currentDate: string;
      daysLate: number;
      logId: number | null;
    };

function dueDateDisplayLabel(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate;
  const m = moment(isoDate, "YYYY-MM-DD");
  return m.isValid() ? m.format("DD/MM/YYYY") : isoDate;
}

async function mergeWhatsAppIntoCompanyLog(
  logId: number | null,
  whatsappMeta: Record<string, unknown>
): Promise<void> {
  if (logId == null) return;
  try {
    const log = await CompanyLog.findByPk(logId);
    if (!log) return;
    const prev =
      log.metadata && typeof log.metadata === "object"
        ? { ...log.metadata }
        : {};
    await log.update({
      metadata: {
        ...prev,
        whatsapp: whatsappMeta
      }
    });
  } catch (err) {
    logger.warn({ err, logId }, "mergeWhatsAppIntoCompanyLog failed");
  }
}

/**
 * Extensão: WhatsApp nos avisos automáticos. E-mail / auto_block message: fases futuras.
 */
export async function dispatchBillingAutomationEvent(
  event: BillingAutomationHookEvent
): Promise<void> {
  if (event.type === "auto_block") {
    return;
  }

  try {
    const settings = await GetSystemBillingSettingsService();
    if (!settings.enableAutoWhatsAppWarning) {
      return;
    }
    if (event.logId == null) {
      return;
    }

    const company = await Company.findByPk(event.companyId, {
      attributes: ["id", "name", "phone"]
    });
    if (!company) return;

    const dueLabel = dueDateDisplayLabel(event.dueDate);
    const body =
      event.type === "warning_before_due"
        ? templateWarningBeforeDue(dueLabel)
        : templateWarningAfterDue(dueLabel);

    const result = await trySendBillingWhatsAppWarning({
      senderCompanyId: settings.whatsappSenderCompanyId,
      destinationPhone: company.phone,
      body
    });

    if (!result.sent && result.skippedReason === "send_failed") {
      try {
        await notifySuperAdminsBillingWhatsAppFailed(
          company,
          result.error != null ? String(result.error) : undefined
        );
      } catch (notifyErr) {
        logger.warn(
          { err: notifyErr, companyId: company.id },
          "[UserNotification] billing_whatsapp_failed_notify_hook_failed"
        );
      }
    }

    await mergeWhatsAppIntoCompanyLog(event.logId, {
      channel: "whatsapp",
      attempted: true,
      sent: result.sent,
      ...(result.error ? { error: result.error } : {}),
      ...(result.skippedReason ? { skippedReason: result.skippedReason } : {}),
      ...(result.destinationDigits
        ? { destinationLast4: result.destinationDigits.slice(-4) }
        : {})
    });
  } catch (err) {
    logger.warn({ err, event }, "dispatchBillingAutomationEvent failed");
    const logId = "logId" in event ? event.logId : null;
    if (logId != null) {
      await mergeWhatsAppIntoCompanyLog(logId, {
        channel: "whatsapp",
        attempted: true,
        sent: false,
        error: "hook_exception"
      });
    }
  }
}
