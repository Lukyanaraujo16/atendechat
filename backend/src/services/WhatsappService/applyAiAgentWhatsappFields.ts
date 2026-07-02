import { loadCompanyPlanContextByCompanyId } from "../../middleware/loadCompanyEffectiveFeatures";
import {
  resolveAiAgentWhatsappFields,
  AI_AGENT_PLAN_FEATURE_KEY
} from "../AiAgentService/resolveAiAgentWhatsappFields";

export async function applyAiAgentFieldsToWhatsappData(
  companyId: number,
  data: {
    aiAgentId?: unknown;
    aiAgentEnabled?: unknown;
  },
  existing?: {
    aiAgentId?: number | null;
    aiAgentEnabled?: boolean;
  }
): Promise<{ aiAgentId: number | null; aiAgentEnabled: boolean } | null> {
  if (
    data.aiAgentId === undefined &&
    data.aiAgentEnabled === undefined
  ) {
    return null;
  }

  const ctx = await loadCompanyPlanContextByCompanyId(companyId);
  const planHasAiAgent =
    ctx?.featureMap[AI_AGENT_PLAN_FEATURE_KEY] === true;

  return resolveAiAgentWhatsappFields({
    companyId,
    planHasAiAgent,
    aiAgentId: data.aiAgentId,
    aiAgentEnabled: data.aiAgentEnabled,
    existingAiAgentId: existing?.aiAgentId,
    existingAiAgentEnabled: existing?.aiAgentEnabled
  });
}
