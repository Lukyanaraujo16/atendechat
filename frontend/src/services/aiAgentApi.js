import api from "./api";

export function listAiAgents() {
  return api.get("/ai-agents");
}

export function getAiAgent(id) {
  return api.get(`/ai-agents/${id}`);
}

export function createAiAgent(data) {
  return api.post("/ai-agents", data);
}

export function updateAiAgent(id, data) {
  return api.put(`/ai-agents/${id}`, data);
}

export function deleteAiAgent(id) {
  return api.delete(`/ai-agents/${id}`);
}

export function listAiAgentShadowSuggestions(params = {}) {
  return api.get("/ai-agents/shadow-suggestions", { params });
}

export function getAiAgentShadowSuggestionsSummary(params = {}) {
  return api.get("/ai-agents/shadow-suggestions/summary", { params });
}

export function upsertAiAgentShadowSuggestionReview(logId, data) {
  return api.post(`/ai-agents/shadow-suggestions/${logId}/review`, data);
}

export function getAiAgentProfile(agentId) {
  return api.get(`/ai-agents/${agentId}/profile`);
}

export function updateAiAgentProfile(agentId, data) {
  return api.put(`/ai-agents/${agentId}/profile`, data);
}

export function previewAiAgentProfilePrompt(agentId, data) {
  return api.post(`/ai-agents/${agentId}/profile/preview`, data);
}

export function checkAiAgentSimulatorCredential(agentId) {
  return api.get(`/ai-agents/${agentId}/simulator/credential-check`);
}

export function createAiAgentSimulatorSession(agentId) {
  return api.post(`/ai-agents/${agentId}/simulator/sessions`);
}

export function listAiAgentSimulatorSessions(agentId, params = {}) {
  return api.get(`/ai-agents/${agentId}/simulator/sessions`, { params });
}

export function getAiAgentSimulatorSession(agentId, sessionId) {
  return api.get(`/ai-agents/${agentId}/simulator/sessions/${sessionId}`);
}

export function sendAiAgentSimulatorMessage(agentId, sessionId, data) {
  return api.post(`/ai-agents/${agentId}/simulator/sessions/${sessionId}/messages`, data);
}

export function endAiAgentSimulatorSession(agentId, sessionId) {
  return api.post(`/ai-agents/${agentId}/simulator/sessions/${sessionId}/end`);
}

export function upsertAiAgentSimulatorMessageReview(agentId, sessionId, messageId, data) {
  return api.post(
    `/ai-agents/${agentId}/simulator/sessions/${sessionId}/messages/${messageId}/review`,
    data
  );
}

export function getAiAgentKnowledgeBases(agentId) {
  return api.get(`/ai-agents/${agentId}/knowledge-bases`);
}

export function syncAiAgentKnowledgeBases(agentId, { links }) {
  return api.put(`/ai-agents/${agentId}/knowledge-bases`, { links });
}

export function getAiAgentKnowledgeSettings(agentId) {
  return api.get(`/ai-agents/${agentId}/knowledge-settings`);
}

export function updateAiAgentKnowledgeSettings(agentId, data) {
  return api.put(`/ai-agents/${agentId}/knowledge-settings`, data);
}

export function testAiAgentKnowledgeRetrieval(agentId, data) {
  return api.post(`/ai-agents/${agentId}/knowledge-retrieval/test`, data);
}

export function listAiAgentKnowledgeRetrievals(agentId, params = {}) {
  return api.get(`/ai-agents/${agentId}/knowledge-retrievals`, { params });
}
