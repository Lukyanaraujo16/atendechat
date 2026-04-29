import Plan from "../../models/Plan";
import Company from "../../models/Company";
import PlanFeature from "../../models/PlanFeature";
import { mergePlanPersistedWithLegacy } from "./GetEffectivePlanFeaturesService";
import { resolvePlanIdForQuery } from "./planIdResolve";

/** Lista planos com `companiesCount` (empresas com `planId` igual). */
const FindAllPlanService = async (): Promise<Array<Record<string, unknown>>> => {
  const plans = await Plan.findAll({
    order: [["name", "ASC"]]
  });

  const withCounts = await Promise.all(
    plans.map(async (plan) => {
      const pid = resolvePlanIdForQuery(plan.id);
      const companiesCount =
        pid != null ? await Company.count({ where: { planId: pid } }) : 0;
      const rows =
        pid != null
          ? await PlanFeature.findAll({
              where: { planId: pid }
            })
          : [];
      return {
        ...plan.toJSON(),
        companiesCount,
        planFeatures: mergePlanPersistedWithLegacy(plan, rows)
      };
    })
  );

  return withCounts;
};

export default FindAllPlanService;
