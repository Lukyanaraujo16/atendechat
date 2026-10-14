import { Op } from "sequelize";
import moment from "moment-timezone";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import Invoices from "../../models/Invoices";
import sequelize from "../../database";
import { getCompanyEffectivePlanValue } from "../../helpers/getCompanyEffectivePlanValue";
import { resolvePlanIdForQuery } from "../PlanService/planIdResolve";
import { buildCompetence, buildCycleKey } from "./computeNextDueDate";
import { recordFinancialEvent } from "./recordFinancialEvent";
import { logger } from "../../utils/logger";
import { saasBillingFlags } from "../../config/saasBillingFlags";

const DAYS_BEFORE = 20;

/**
 * Gera fatura SaaS para um ciclo (companyId + cycleKey) com lock/unique.
 */
export async function generateInvoiceForCompany(
  company: Company
): Promise<Invoices | null> {
  if (!company.dueDate) return null;

  const planPid = resolvePlanIdForQuery(company.planId);
  if (planPid == null) return null;

  const plan = await Plan.findByPk(planPid);
  if (!plan) return null;

  const tz =
    company.timezone && moment.tz.zone(company.timezone)
      ? company.timezone
      : "America/Sao_Paulo";
  const due = moment.tz(company.dueDate, tz).startOf("day");
  if (!due.isValid()) return null;

  const today = moment.tz(tz).startOf("day");
  const days = due.diff(today, "days");
  if (days >= DAYS_BEFORE) return null;

  const cycleKey = buildCycleKey(company.dueDate);
  const competence = buildCompetence(company.dueDate);
  const billValue = getCompanyEffectivePlanValue({
    contractedPlanValue: (company as any).contractedPlanValue,
    plan
  });

  return sequelize.transaction(async t => {
    const existing = await Invoices.findOne({
      where: {
        companyId: company.id,
        cycleKey,
        status: { [Op.ne]: "cancelled" }
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });
    if (existing) return existing;

    // Fallback legado: mesma data de vencimento (prefixo)
    const datePrefix = due.format("YYYY-MM-DD");
    const legacy = await Invoices.findOne({
      where: {
        companyId: company.id,
        status: { [Op.ne]: "cancelled" },
        dueDate: { [Op.like]: `${datePrefix}%` }
      },
      transaction: t
    });
    if (legacy) {
      if (!legacy.cycleKey) {
        await legacy.update(
          {
            cycleKey,
            competence,
            planIdSnapshot: plan.id,
            planNameSnapshot: plan.name,
            recurrenceSnapshot: company.recurrence || "MENSAL"
          },
          { transaction: t }
        );
      }
      return legacy;
    }

    try {
      const invoice = await Invoices.create(
        {
          detail: plan.name,
          status: "open",
          value: billValue,
          dueDate: due.format("YYYY-MM-DD"),
          companyId: company.id,
          competence,
          cycleKey,
          planIdSnapshot: plan.id,
          planNameSnapshot: plan.name,
          recurrenceSnapshot: company.recurrence || "MENSAL",
          paymentSource: null,
          legacyUnknown: false,
          gatewaySyncStatus: "none"
        },
        { transaction: t }
      );

      await recordFinancialEvent({
        companyId: company.id,
        invoiceId: invoice.id,
        eventType: "invoice_created",
        payload: { cycleKey, competence, value: billValue },
        transaction: t
      });

      return invoice;
    } catch (err: any) {
      if (err?.name === "SequelizeUniqueConstraintError") {
        return Invoices.findOne({
          where: { companyId: company.id, cycleKey },
          transaction: t
        });
      }
      throw err;
    }
  });
}

export async function runSaasInvoiceGenerationJob(): Promise<void> {
  if (!saasBillingFlags.autoInvoice()) {
    logger.info("[SaasBilling] auto invoice desabilitado (SAAS_BILLING_AUTO_INVOICE)");
    return;
  }

  const companies = await Company.findAll({
    where: { status: true }
  });

  for (const c of companies) {
    try {
      await generateInvoiceForCompany(c);
    } catch (err) {
      logger.warn({ err, companyId: c.id }, "[SaasBilling] invoice_generate_failed");
    }
  }
}
