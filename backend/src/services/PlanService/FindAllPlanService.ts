import Plan from "../../models/Plan";
import Company from "../../models/Company";
import PlanFeature from "../../models/PlanFeature";
import { mergePlanPersistedWithLegacy } from "./GetEffectivePlanFeaturesService";

/** Lista planos com `companiesCount` (empresas com `planId` igual). */
const FindAllPlanService = async (): Promise<Array<Record<string, unknown>>> => {
  const plans = await Plan.findAll({
    order: [["name", "ASC"]]
  });

  const withCounts = await Promise.all(
    plans.map(async (plan) => {
      const companiesCount = await Company.count({
        where: { planId: plan.id }
      });
      const rows = await PlanFeature.findAll({
        where: { planId: plan.id }
      });
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
