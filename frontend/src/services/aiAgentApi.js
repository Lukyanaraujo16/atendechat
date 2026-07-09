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
