import { Transaction } from "sequelize";
import moment from "moment-timezone";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import SaaSSubscriptionRenewal from "../../models/SaaSSubscriptionRenewal";
import sequelize from "../../database";
import { computeNextDueDate } from "./computeNextDueDate";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { createCompanyLog } from "../CompanyService/CreateCompanyLogService";
import { logger } from "../../utils/logger";
import {
  notifySuperAdminsBillingReactivated,
  notifySuperAdminsBillingRenewal
} from "../CompanyService/notifySuperAdminsBilling";

export type RenewalReason =
  | "payment_confirmed"
  | "manual_renew"
  | "courtesy"
  | "due_date_adjustment";

export type ApplySubscriptionRenewalInput = {
  companyId: number;
  reason: RenewalReason;
  actorUserId?: number | null;
  invoiceId?: number | null;
  paymentId?: number | null;
  /** Para due_date_adjustment: data explícita. */
  explicitDueDate?: string | null;
  idempotencyKey?: string | null;
  /** Não estende dueDate (ex.: cortesia sem renovação de ciclo). */
  skipDueDateExtension?: boolean;
  transaction?: Transaction;
};

export type ApplySubscriptionRenewalResult = {
  company: Company;
  renewal: SaaSSubscriptionRenewal | null;
  autoUnblocked: boolean;
  alreadyApplied: boolean;
};

/**
 * Motor único de renovação — idempotente por idempotencyKey.
 * Cortesia/ajuste/manual_renew/payment compartilham o mesmo cálculo de meses.
 */
export async function applySubscriptionRenewal(
  input: ApplySubscriptionRenewalInput
): Promise<ApplySubscriptionRenewalResult> {
  const run = async (t: Transaction): Promise<ApplySubscriptionRenewalResult> => {
    if (input.idempotencyKey) {
      const existing = await SaaSSubscriptionRenewal.findOne({
        where: { idempotencyKey: input.idempotencyKey },
        transaction: t
      });
      if (existing) {
        const company = await Company.findByPk(input.companyId, {
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);
        return {
          company,
          renewal: existing,
          autoUnblocked: false,
          alreadyApplied: true
        };
      }
    }

    const company = await Company.findByPk(input.companyId, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (!company) throw new AppError("ERR_NO_COMPANY_FOUND", 404);

    const wasBlocked = company.status === false;
    const previousDueDate = company.dueDate || null;

    if (input.skipDueDateExtension) {
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
        alreadyApplied: false
      };
    }

    let newDueDate: string;
    let months: number;
    let recurrence: string;

    if (input.reason === "due_date_adjustment" && input.explicitDueDate) {
      const tz =
        company.timezone && moment.tz.zone(company.timezone)
          ? company.timezone
          : "America/Sao_Paulo";
      const parsed = moment.tz(input.explicitDueDate, tz).startOf("day");
      if (!parsed.isValid()) {
        throw new AppError("ERR_INVALID_DUE_DATE", 400);
      }
      newDueDate = parsed.format("YYYY-MM-DD");
      months = 0;
      recurrence = String(company.recurrence || "MENSAL").toUpperCase();
    } else {
      const computed = computeNextDueDate({
        currentDueDate: company.dueDate,
        recurrence: company.recurrence,
        timezone: company.timezone
      });
      newDueDate = computed.newDueDate;
      months = computed.months;
      recurrence = computed.recurrence;
    }

    await company.update(
      {
        dueDate: newDueDate,
        ...(wasBlocked ? { status: true } : {})
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
          recurrence,
          monthsAdded: months,
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
        const existing = await SaaSSubscriptionRenewal.findOne({
          where: { idempotencyKey: input.idempotencyKey },
          transaction: t
        });
        await company.reload({ transaction: t });
        return {
          company,
          renewal: existing,
          autoUnblocked: false,
          alreadyApplied: true
        };
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
        months,
        recurrence,
        autoUnblocked: wasBlocked
      },
      transaction: t
    });

    await company.reload({ transaction: t });
    return {
      company,
      renewal,
      autoUnblocked: wasBlocked,
      alreadyApplied: false
    };
  };

  const result = input.transaction
    ? await run(input.transaction)
    : await sequelize.transaction(run);

  if (!result.alreadyApplied && result.renewal && input.actorUserId != null) {
    try {
      await createCompanyLog({
        companyId: result.company.id,
        action: input.reason === "manual_renew" ? "renew" : `renew_${input.reason}`,
        userId: input.actorUserId,
        metadata: {
          previousDueDate: result.renewal.previousDueDate,
          newDueDate: result.renewal.newDueDate,
          reason: input.reason
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

  return result;
}
