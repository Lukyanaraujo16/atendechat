import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import sequelize from "../../database";
import Plan from "../../models/Plan";
import Company from "../../models/Company";
import {
  getChangedPropagationKeys,
  mergeCompanyPermissionsForPropagation,
  normalizePropagationMode,
  PLAN_PROPAGATION_MODULE_KEYS,
  PlanPropagationMode
} from "./PlanModulePropagation";

interface PlanData {
  name?: string;
  id?: number | string;
  users?: number;
  connections?: number;
  queues?: number;
  value?: number;
  useCampaigns?: boolean;
  useSchedules?: boolean;
  useInternalChat?: boolean;
  useExternalApi?: boolean;
  useKanban?: boolean;
  useOpenAi?: boolean;
  useIntegrations?: boolean;
  propagationMode?: unknown;
}

const PLAN_UPDATE_FIELDS = [
  "name",
  "users",
  "connections",
  "queues",
  "value",
  ...PLAN_PROPAGATION_MODULE_KEYS
] as const;

function pickPlanUpdatePayload(
  data: Record<string, unknown>
): Record<string, unknown> {
  return PLAN_UPDATE_FIELDS.reduce((acc, k) => {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      acc[k] = data[k];
    }
    return acc;
  }, {} as Record<string, unknown>);
}

export type PlanPropagationSummary = {
  mode: PlanPropagationMode;
  companiesUpdated: number;
  moduleKeys: string[];
  applied: boolean;
};

export type UpdatePlanServiceResult = Record<string, unknown> & {
  propagation: PlanPropagationSummary;
};

const UpdatePlanService = async (
  planData: PlanData
): Promise<UpdatePlanServiceResult> => {
  const { id, propagationMode: rawMode, ...incoming } = planData;
  const propagationMode = normalizePropagationMode(rawMode);

  if (id === undefined || id === null) {
    throw new AppError("ERR_PLAN_ID_REQUIRED", 400);
  }

  const incomingRecord = incoming as Record<string, unknown>;
  const updatePayload = pickPlanUpdatePayload(incomingRecord);

  const result = await sequelize.transaction(async (t: Transaction) => {
    const planBefore = await Plan.findByPk(id, {
      transaction: t,
      lock: Transaction.LOCK.UPDATE
    });

    if (!planBefore) {
      throw new AppError("ERR_NO_PLAN_FOUND", 404);
    }

    const changed = getChangedPropagationKeys(planBefore, incomingRecord);

    await planBefore.update(updatePayload, { transaction: t });

    let companiesUpdated = 0;

    if (
      propagationMode !== "none" &&
      Object.keys(changed).length > 0 &&
      (propagationMode === "respect_overrides" ||
        propagationMode === "force_all")
    ) {
      const companies = await Company.findAll({
        where: { planId: planBefore.id },
        transaction: t
      });

      const updateResults = await Promise.all(
        companies.map(async company => {
          const prev = company.modulePermissions || {};
          const next = mergeCompanyPermissionsForPropagation(
            prev,
            changed,
            propagationMode
          );
          if (JSON.stringify(prev) !== JSON.stringify(next)) {
            await company.update(
              { modulePermissions: next },
              { transaction: t }
            );
            return 1;
          }
          return 0;
        })
      );
      companiesUpdated = updateResults.reduce((a, b) => a + b, 0);

      console.info(
        "[PlanModulePropagation]",
        JSON.stringify({
          event: "plan_module_propagation",
          planId: planBefore.id,
          planName: planBefore.name,
          propagationMode,
          moduleKeysChanged: Object.keys(changed),
          companiesAffected: companiesUpdated,
          companiesOnPlan: companies.length
        })
      );
    } else if (Object.keys(changed).length > 0) {
      console.info(
        "[PlanModulePropagation]",
        JSON.stringify({
          event: "plan_modules_changed_no_company_push",
          planId: planBefore.id,
          planName: planBefore.name,
          propagationMode,
          moduleKeysChanged: Object.keys(changed)
        })
      );
    }

    const propagation: PlanPropagationSummary = {
      mode: propagationMode,
      companiesUpdated,
      moduleKeys: Object.keys(changed),
      applied:
        propagationMode !== "none" &&
        Object.keys(changed).length > 0 &&
        (propagationMode === "respect_overrides" ||
          propagationMode === "force_all")
    };

    const json = planBefore.toJSON() as Record<string, unknown>;
    return {
      ...json,
      propagation
    };
  });

  return result as UpdatePlanServiceResult;
};

export default UpdatePlanService;
