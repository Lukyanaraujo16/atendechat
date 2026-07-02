import {
  AI_AGENT_FEATURE_KEY,
  AI_AGENT_UI_ENABLED,
} from "../config/aiAgentFeature";
import { canUseAiAgent } from "./canUseAiAgent";

/** Plano da empresa inclui o módulo Agente de IA (sem checar permissão individual). */
export function planHasAiAgentModule(planFlags) {
  return planFlags?.effectiveFeatures?.[AI_AGENT_FEATURE_KEY] === true;
}

/** Acesso efetivo à rota/tela do Agente de IA (plano + permissão do utilizador). */
export function canAccessAiAgentRoute(user, planFlags) {
  return canUseAiAgent(user, planFlags);
}

/** Menu/aba do Agente de IA — só quando a UI estiver habilitada na fase correspondente. */
export function shouldShowAiAgentNav(user, planFlags) {
  return (
    AI_AGENT_UI_ENABLED &&
    planFlags?.loaded &&
    canUseAiAgent(user, planFlags)
  );
}

export { AI_AGENT_FEATURE_KEY, AI_AGENT_ROUTE_PATH, AI_AGENT_UI_ENABLED } from "../config/aiAgentFeature";
