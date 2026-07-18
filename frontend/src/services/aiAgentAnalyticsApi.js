import api from "./api";

export function getAiAgentAnalyticsDashboard(params = {}) {
  return api.get("/ai-agents/analytics/dashboard", { params });
}

export function getAiAgentAnalytics(params = {}) {
  return api.get("/ai-agents/analytics/agents", { params });
}

export function getAiKnowledgeBaseAnalytics(params = {}) {
  return api.get("/ai-agents/analytics/knowledge-bases", { params });
}

export function getAiDocumentAnalytics(params = {}) {
  return api.get("/ai-agents/analytics/documents", { params });
}

export function getAiAgentHealth(params = {}) {
  return api.get("/ai-agents/analytics/health", { params });
}

export function getAiAgentHealthScore(params = {}) {
  return api.get("/ai-agents/analytics/health-score", { params });
}

export function listAiKnowledgeGaps(params = {}) {
  return api.get("/ai-agents/analytics/knowledge-gaps", { params });
}

export function updateAiKnowledgeGap(id, data) {
  return api.patch(`/ai-agents/analytics/knowledge-gaps/${id}`, data);
}

export function listAiKnowledgeSuggestions(params = {}) {
  return api.get("/ai-agents/analytics/knowledge-suggestions", { params });
}

export function createAiKnowledgeSuggestion(data) {
  return api.post("/ai-agents/analytics/knowledge-suggestions", data);
}

export function updateAiKnowledgeSuggestion(id, data) {
  return api.patch(`/ai-agents/analytics/knowledge-suggestions/${id}`, data);
}

export function listAiAgentReplays(params = {}) {
  return api.get("/ai-agents/analytics/replays", { params });
}

export function getAiAgentReplay(id) {
  return api.get(`/ai-agents/analytics/replays/${id}`);
}

export function getAiAgentPromptDiff(params = {}) {
  return api.get("/ai-agents/analytics/prompt-diff", { params });
}
