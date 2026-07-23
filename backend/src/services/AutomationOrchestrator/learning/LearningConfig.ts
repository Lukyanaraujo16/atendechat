import {
  AutomationLearningConfig,
  DEFAULT_LEARNING_CONFIG
} from "../../../config/automationLearningConstants";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";

const byCompany = new Map<number, AutomationLearningConfig>();

function cloneDefault(): AutomationLearningConfig {
  return JSON.parse(JSON.stringify(DEFAULT_LEARNING_CONFIG));
}

export function getLearningConfig(companyId?: number): AutomationLearningConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function setLearningConfig(
  companyId: number,
  partial: Partial<AutomationLearningConfig> | Record<string, unknown>
): AutomationLearningConfig {
  const current = getLearningConfig(companyId);
  const p = partial as Partial<AutomationLearningConfig>;
  const merged: AutomationLearningConfig = {
    ...current,
    ...p,
    patternThresholds: {
      ...current.patternThresholds,
      ...(p.patternThresholds || {})
    },
    riskThresholds: {
      ...current.riskThresholds,
      ...(p.riskThresholds || {})
    },
    impactThresholds: {
      ...current.impactThresholds,
      ...(p.impactThresholds || {})
    },
    qualityWeights: {
      ...current.qualityWeights,
      ...(p.qualityWeights || {})
    },
    confidenceWeights: {
      ...current.confidenceWeights,
      ...(p.confidenceWeights || {})
    },
    allowedCandidateTypes:
      p.allowedCandidateTypes || current.allowedCandidateTypes,
    allowedPromotionModes:
      p.allowedPromotionModes || current.allowedPromotionModes,
    liveIntegrationEnabled: false,
    productionPromotionEnabled: false,
    autoPromotionEnabled: false,
    usesGenerativeAi: false
  };
  byCompany.set(companyId, merged);
  observabilityRepository.putSettingFireAndForget(
    companyId,
    "learning",
    merged as any
  );
  return merged;
}

export function __resetLearningConfigForTests(): void {
  byCompany.clear();
}

export default { getLearningConfig, setLearningConfig };
