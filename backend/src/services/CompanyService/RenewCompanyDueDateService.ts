import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import sequelize from "../../database";
import { createCompanyLog } from "./CreateCompanyLogService";
import { logger } from "../../utils/logger";
import {
  notifySuperAdminsBillingReactivated,
  notifySuperAdminsBillingRenewal
} from "./notifySuperAdminsBilling";

/** Alinhado ao formulário de empresas (CompaniesManager). */
const MONTHS_BY_RECURRENCE: Record<string, number> = {
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12
};

export type RenewCompanyDueDateResult = {
  company: Company;
  /** `true` se a empresa estava bloqueada e foi reativada nesta renovação. */
  autoUnblocked: boolean;
};

/**
 * Renova vencimento: a partir do dueDate atual se ainda não venceu, senão a partir de hoje (fuso da empresa).
 * Se a empresa estiver inativa (bloqueada), reativa após renovar com sucesso.
 */
const RenewCompanyDueDateService = async (
  id: string | number,
  userId?: number | string | null
): Promise<RenewCompanyDueDateResult> => {
  const company = await Company.findByPk(id);
  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  const previousDueDate = company.dueDate || null;
  const previousStatus = company.status;
  const wasBlocked = company.status === false;

  const rec = String(company.recurrence || "").toUpperCase();
  const months = MONTHS_BY_RECURRENCE[rec];
  if (!months) {
    throw new AppError(
      "ERR_INVALID_RECURRENCE",
      400,
      "Defina a recorrência da empresa (MENSAL, TRIMESTRAL, SEMESTRAL, ANUAL, etc.)."
    );
  }

  const tzRaw = company.timezone?.trim();
  const tz =
    tzRaw && moment.tz.zone(tzRaw) ? tzRaw : "America/Sao_Paulo";

  const now = moment.tz(tz).startOf("day");
  let base = now;

  if (company.dueDate) {
    const due = moment.tz(company.dueDate, tz).startOf("day");
    if (due.isValid() && due.isSameOrAfter(now)) {
      base = due;
    }
  }

  const newDue = base.clone().add(months, "months").format("YYYY-MM-DD");

  await sequelize.transaction(async (t) => {
    await company.update(
      {
        dueDate: newDue,
        ...(wasBlocked ? { status: true } : {})
      },
      { transaction: t }
    );
  });

  await company.reload();

  if (userId != null && userId !== "") {
    await createCompanyLog({
      companyId: company.id,
      action: "renew",
      userId,
      metadata: { previousDueDate, newDueDate: newDue }
    });

    if (wasBlocked) {
      await createCompanyLog({
        companyId: company.id,
        action: "auto_unblock_after_renew",
        userId,
        metadata: {
          previousStatus,
          newStatus: true,
          previousDueDate,
          newDueDate: newDue,
          kind: "automated_after_renew"
        }
      });
    }

    try {
      await notifySuperAdminsBillingRenewal(company, previousDueDate, newDue);
      if (wasBlocked) {
        await notifySuperAdminsBillingReactivated(company, newDue);
      }
    } catch (err) {
      logger.warn(
        { err, companyId: company.id },
        "[UserNotification] billing_renew_notify_hook_failed"
      );
    }
  }

  return { company, autoUnblocked: wasBlocked };
};

export default RenewCompanyDueDateService;
