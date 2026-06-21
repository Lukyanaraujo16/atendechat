import AppError from "../errors/AppError";
import {
  INSTAGRAM_INTEGRATION_FEATURE_KEY,
  INSTAGRAM_NOT_AVAILABLE_IN_PLAN_MSG
} from "../config/instagramIntegrationFeature";
import { loadCompanyPlanContextByCompanyId } from "../middleware/loadCompanyEffectiveFeatures";

export const isInstagramIntegrationEnabledForCompany = async (
  companyId: number
): Promise<boolean> => {
  const ctx = await loadCompanyPlanContextByCompanyId(companyId);
  return ctx?.featureMap[INSTAGRAM_INTEGRATION_FEATURE_KEY] === true;
};

export const assertInstagramIntegrationInPlan = async (
  companyId: number
): Promise<void> => {
  const enabled = await isInstagramIntegrationEnabledForCompany(companyId);
  if (!enabled) {
    throw new AppError(
      "ERR_INSTAGRAM_NOT_AVAILABLE_IN_PLAN",
      403,
      INSTAGRAM_NOT_AVAILABLE_IN_PLAN_MSG
    );
  }
};
