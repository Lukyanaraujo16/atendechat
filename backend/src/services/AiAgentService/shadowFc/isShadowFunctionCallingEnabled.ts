import Setting from "../../../models/Setting";
import AiAgentKnowledgeSettings from "../../../models/AiAgentKnowledgeSettings";
import Whatsapp from "../../../models/Whatsapp";
import hasPlanFeature from "../../../helpers/hasPlanFeature";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../../../config/automationToolConstants";
import { SHADOW_FC_COMPANY_SETTING_KEY } from "../../../config/automationShadowFcConstants";
import { AI_AGENT_PLAN_FEATURE_KEY } from "../resolveAiAgentWhatsappFields";

/**
 * Rollout FC Shadow: empresa ∧ conexão ∧ agente ∧ features.
 * Tudo OFF por padrão.
 */
export async function isShadowFunctionCallingEnabled(input: {
  companyId: number;
  aiAgentId: number;
  whatsappId: number;
}): Promise<{
  enabled: boolean;
  reason?: string;
  gates: {
    planAgent: boolean;
    planTools: boolean;
    company: boolean;
    connection: boolean;
    agent: boolean;
  };
}> {
  const [planAgent, planTools, companySetting, whatsapp, agentSettings] =
    await Promise.all([
      hasPlanFeature(input.companyId, AI_AGENT_PLAN_FEATURE_KEY),
      hasPlanFeature(input.companyId, AUTOMATION_AI_TOOLS_FEATURE_KEY),
      Setting.findOne({
        where: {
          companyId: input.companyId,
          key: SHADOW_FC_COMPANY_SETTING_KEY
        }
      }),
      Whatsapp.findOne({
        where: { id: input.whatsappId, companyId: input.companyId },
        attributes: ["id", "functionCallingShadow"]
      }),
      AiAgentKnowledgeSettings.findOne({
        where: {
          companyId: input.companyId,
          aiAgentId: input.aiAgentId
        },
        attributes: ["id", "functionCallingShadow"]
      })
    ]);

  const gates = {
    planAgent: planAgent === true,
    planTools: planTools === true,
    company: companySetting?.value === "enabled" || companySetting?.value === "true",
    connection: whatsapp?.functionCallingShadow === true,
    agent: agentSettings?.functionCallingShadow === true
  };

  if (!gates.planAgent) {
    return { enabled: false, reason: "plan_agent_missing", gates };
  }
  if (!gates.planTools) {
    return { enabled: false, reason: "plan_tools_missing", gates };
  }
  if (!gates.company) {
    return { enabled: false, reason: "company_disabled", gates };
  }
  if (!gates.connection) {
    return { enabled: false, reason: "connection_disabled", gates };
  }
  if (!gates.agent) {
    return { enabled: false, reason: "agent_disabled", gates };
  }

  return { enabled: true, gates };
}

export default { isShadowFunctionCallingEnabled };
