import { Request } from "express";

import Company from "../models/Company";
import Plan from "../models/Plan";
import {
  loadPersistedPlanFeatureMap,
  getEffectivePlanFeaturesMap
} from "../services/PlanService/GetEffectivePlanFeaturesService";
import { getPlanIdFromContext } from "../services/PlanService/planIdResolve";
import {
  buildEffectiveModuleFlagsFromFeatureMap,
  EffectiveModuleFlags
} from "../services/CompanyService/GetEffectiveModuleFlagsService";

export type CompanyPlanContext = {
  company: Company;
  featureMap: Record<string, boolean>;
  effectiveModules: EffectiveModuleFlags;
};

export async function loadCompanyPlanContext(
  req: Request
): Promise<CompanyPlanContext | null> {
  const companyId = req.user?.companyId;
  if (!companyId) return null;

  const company = await Company.findByPk(companyId, {
    include: [{ model: Plan, as: "plan" }]
  });
  if (!company?.plan) return null;

  const persisted = await loadPersistedPlanFeatureMap(getPlanIdFromContext(company));
  const featureMap = getEffectivePlanFeaturesMap(
    company.plan,
    persisted,
    company.modulePermissions
  );
  const effectiveModules = buildEffectiveModuleFlagsFromFeatureMap(
    featureMap,
    company.modulePermissions
  );

  return { company, featureMap, effectiveModules };
}
