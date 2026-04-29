import Company from "../models/Company";
import Plan from "../models/Plan";
import {
  loadPersistedPlanFeatureMap,
  resolvePlanFeature
} from "../services/PlanService/GetEffectivePlanFeaturesService";
import { getPlanIdFromContext } from "../services/PlanService/planIdResolve";

/**
 * Indica se a empresa tem a feature ativa (plano + PlanFeatures + override false em modulePermissions).
 */
const hasPlanFeature = async (
  companyId: string | number,
  featureKey: string
): Promise<boolean> => {
  const company = await Company.findByPk(companyId, {
    include: [{ model: Plan, as: "plan" }]
  });
  if (!company?.plan) return false;
  const persisted = await loadPersistedPlanFeatureMap(getPlanIdFromContext(company));
  return resolvePlanFeature(
    company.plan,
    persisted,
    company.modulePermissions,
    featureKey
  );
};

export default hasPlanFeature;
