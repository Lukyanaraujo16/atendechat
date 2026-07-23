import hasPlanFeature from "../../../helpers/hasPlanFeature";
import AppError from "../../../errors/AppError";
import {
  DEFAULT_AGENTOS_SECURITY_CONFIG,
  AgentOsFeatureKey
} from "../../../config/automationAgentOsSecurityConstants";

/**
 * Fail-closed: plano ausente ou erro de lookup → nega.
 * Sem soft bypass.
 */
export async function assertAgentOsPlanFeature(
  companyId: number,
  featureKey: AgentOsFeatureKey | string
): Promise<void> {
  try {
    const ok = await hasPlanFeature(companyId, featureKey);
    if (ok !== true) {
      throw new AppError(
        "ERR_PLAN_FEATURE_DISABLED",
        403,
        `Plano sem ${featureKey}`
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (DEFAULT_AGENTOS_SECURITY_CONFIG.failClosedOnPlanLookupError) {
      throw new AppError(
        "ERR_PLAN_FEATURE_DISABLED",
        403,
        `Plano sem ${featureKey}`
      );
    }
    throw err;
  }
}

export async function assertAgentOsPlanFeatures(
  companyId: number,
  featureKeys: Array<AgentOsFeatureKey | string>
): Promise<void> {
  for (const key of featureKeys) {
    await assertAgentOsPlanFeature(companyId, key);
  }
}
