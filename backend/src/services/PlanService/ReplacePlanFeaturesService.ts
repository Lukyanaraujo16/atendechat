import { Transaction } from "sequelize";
import PlanFeature from "../../models/PlanFeature";

export type PlanFeatureEntry = { featureKey: string; enabled: boolean };

const ReplacePlanFeaturesService = async (
  planId: number,
  entries: PlanFeatureEntry[],
  transaction?: Transaction
): Promise<void> => {
  await PlanFeature.destroy({ where: { planId }, transaction });
  if (!entries.length) return;
  await PlanFeature.bulkCreate(
    entries.map((e) => ({
      planId,
      featureKey: e.featureKey,
      enabled: e.enabled
    })),
    { transaction }
  );
};

export default ReplacePlanFeaturesService;
