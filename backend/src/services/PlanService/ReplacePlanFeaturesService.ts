import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import PlanFeature from "../../models/PlanFeature";
import { resolvePlanIdForQuery } from "./planIdResolve";

export type PlanFeatureEntry = { featureKey: string; enabled: boolean };

const ReplacePlanFeaturesService = async (
  planId: unknown,
  entries: PlanFeatureEntry[],
  transaction?: Transaction
): Promise<void> => {
  const pid = resolvePlanIdForQuery(planId);
  if (pid == null) {
    throw new AppError("ERR_PLAN_ID_REQUIRED", 400);
  }
  await PlanFeature.destroy({ where: { planId: pid }, transaction });
  if (!entries.length) return;
  await PlanFeature.bulkCreate(
    entries.map((e) => ({
      planId: pid,
      featureKey: e.featureKey,
      enabled: e.enabled
    })),
    { transaction }
  );
};

export default ReplacePlanFeaturesService;
