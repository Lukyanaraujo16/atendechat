import api from "./api";

/** Lista agentes — Console Analytics. */
export function listAiAgents() {
  return api.get("/ai-agents");
}

/** Shadow FC (Console) + Automation Monitor. */
export function getAiAgentShadowEvaluation(id) {
  return api.get(`/ai-agents/shadow-evaluations/${id}`);
}

export function getAiAgentShadowFcDashboard() {
  return api.get("/ai-agents/shadow-evaluations/dashboard");
}

export function updateShadowFcCompanySetting(data = {}) {
  return api.put("/ai-agents/shadow-fc/company-setting", data);
}

export function updateShadowFcAgentSetting(agentId, data = {}) {
  return api.put(`/ai-agents/${agentId}/shadow-fc/setting`, data);
}

export function updateShadowFcConnectionSetting(whatsappId, data = {}) {
  return api.put(`/ai-agents/shadow-fc/connections/${whatsappId}`, data);
}
