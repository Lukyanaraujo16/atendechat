import User from "../../models/User";
import Company from "../../models/Company";
import { logger } from "../../utils/logger";
import CreateUserNotificationService from "../UserNotificationService/CreateUserNotificationService";

type BillingPayload = {
  type: "company_billing";
  companyId: number;
} & Record<string, unknown>;

async function notifyEachSuper(
  type: string,
  title: string,
  body: string,
  payload: BillingPayload
): Promise<void> {
  const supers = await User.findAll({
    where: { super: true },
    attributes: ["id"]
  });
  for (const u of supers) {
    try {
      await CreateUserNotificationService({
        userId: u.id,
        companyId: null,
        type,
        title,
        body,
        data: payload,
        preferenceCategory: "billing"
      });
    } catch (err) {
      logger.warn(
        { err, userId: u.id, type },
        "[UserNotification] super_billing_notify_failed"
      );
    }
  }
}

export async function notifySuperAdminsBillingWarningBefore(
  company: Pick<Company, "id" | "name">,
  dueDate: string
): Promise<void> {
  try {
    await notifyEachSuper(
      "company_billing_warning_before",
      "Cobrança: lembrete pré-vencimento",
      `Aviso automático registado para «${company.name}» (venc. ${dueDate}).`,
      { type: "company_billing", companyId: company.id, dueDate, event: "warning_before" }
    );
  } catch (err) {
    logger.warn({ err, companyId: company.id }, "[UserNotification] billing_warning_before_notify_failed");
  }
}

export async function notifySuperAdminsBillingOverdue(
  company: Pick<Company, "id" | "name">,
  dueDate: string
): Promise<void> {
  try {
    await notifyEachSuper(
      "company_billing_overdue",
      "Cobrança: empresa após vencimento",
      `«${company.name}» está em aviso pós-vencimento (venc. ${dueDate}).`,
      { type: "company_billing", companyId: company.id, dueDate, event: "overdue" }
    );
  } catch (err) {
    logger.warn({ err, companyId: company.id }, "[UserNotification] billing_overdue_notify_failed");
  }
}

export async function notifySuperAdminsBillingAutoBlock(
  company: Pick<Company, "id" | "name">,
  dueDate: string
): Promise<void> {
  try {
    await notifyEachSuper(
      "company_billing_auto_block",
      "Cobrança: empresa bloqueada automaticamente",
      `«${company.name}» foi bloqueada por inadimplência (venc. ${dueDate}).`,
      { type: "company_billing", companyId: company.id, dueDate, event: "auto_block" }
    );
  } catch (err) {
    logger.warn({ err, companyId: company.id }, "[UserNotification] billing_auto_block_notify_failed");
  }
}

export async function notifySuperAdminsBillingWhatsAppFailed(
  company: Pick<Company, "id" | "name">,
  detail?: string
): Promise<void> {
  try {
    await notifyEachSuper(
      "company_billing_whatsapp_failed",
      "Cobrança: falha no WhatsApp",
      `Falha ao enviar aviso de cobrança por WhatsApp para «${company.name}».${detail ? ` (${detail})` : ""}`,
      {
        type: "company_billing",
        companyId: company.id,
        event: "whatsapp_failed",
        ...(detail ? { detail } : {})
      }
    );
  } catch (err) {
    logger.warn(
      { err, companyId: company.id },
      "[UserNotification] billing_whatsapp_failed_notify_failed"
    );
  }
}

export async function notifySuperAdminsBillingRenewal(
  company: Pick<Company, "id" | "name">,
  previousDue: string | null,
  newDue: string
): Promise<void> {
  try {
    await notifyEachSuper(
      "company_billing_renewal",
      "Cobrança: renovação de vencimento",
      `«${company.name}» renovada: novo vencimento ${newDue}.`,
      {
        type: "company_billing",
        companyId: company.id,
        event: "renewal",
        previousDueDate: previousDue,
        newDueDate: newDue
      }
    );
  } catch (err) {
    logger.warn({ err, companyId: company.id }, "[UserNotification] billing_renewal_notify_failed");
  }
}

export async function notifySuperAdminsBillingReactivated(
  company: Pick<Company, "id" | "name">,
  newDue: string
): Promise<void> {
  try {
    await notifyEachSuper(
      "company_billing_reactivated",
      "Cobrança: empresa reativada",
      `«${company.name}» foi reativada após renovação (venc. ${newDue}).`,
      {
        type: "company_billing",
        companyId: company.id,
        event: "reactivated",
        newDueDate: newDue
      }
    );
  } catch (err) {
    logger.warn(
      { err, companyId: company.id },
      "[UserNotification] billing_reactivated_notify_failed"
    );
  }
}
