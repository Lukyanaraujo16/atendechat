import {
  CognitiveMemoryConfig,
  DEFAULT_COGNITIVE_MEMORY_CONFIG
} from "../../../../config/automationCognitiveMemoryConstants";

const byCompany = new Map<number, CognitiveMemoryConfig>();

function cloneDefault(): CognitiveMemoryConfig {
  return JSON.parse(JSON.stringify(DEFAULT_COGNITIVE_MEMORY_CONFIG));
}

export function getCognitiveMemoryConfig(
  companyId?: number
): CognitiveMemoryConfig {
  if (companyId != null && byCompany.has(companyId)) {
    return byCompany.get(companyId)!;
  }
  return cloneDefault();
}

export function setCognitiveMemoryConfig(
  companyId: number,
  partial: Partial<CognitiveMemoryConfig> | Record<string, unknown>
): CognitiveMemoryConfig {
  const current = getCognitiveMemoryConfig(companyId);
  const p = partial as Partial<CognitiveMemoryConfig>;
  const merged: CognitiveMemoryConfig = {
    ...current,
    ...p,
    retention: { ...current.retention, ...(p.retention || {}) },
    scoring: {
      ...current.scoring,
      ...(p.scoring || {}),
      typeBoost: {
        ...current.scoring.typeBoost,
        ...((p.scoring as any)?.typeBoost || {})
      }
    },
    limits: { ...current.limits, ...(p.limits || {}) },
    workingMemory: { ...current.workingMemory, ...(p.workingMemory || {}) },
    importance: { ...current.importance, ...(p.importance || {}) },
    vectorEnabled: false,
    usesEmbeddings: false
  };
  byCompany.set(companyId, merged);
  return merged;
}

export function __resetCognitiveMemoryConfigForTests(): void {
  byCompany.clear();
}

export default { getCognitiveMemoryConfig, setCognitiveMemoryConfig };
