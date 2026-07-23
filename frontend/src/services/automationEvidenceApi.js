import api from "./api";

export function getEvidenceDashboard() {
  return api.get("/automation/evidence/dashboard");
}

export function getEvidenceReadiness() {
  return api.get("/automation/evidence/readiness");
}

export function getEvidenceRecommendations() {
  return api.get("/automation/evidence/recommendations");
}

export function getEvidenceProviders() {
  return api.get("/automation/evidence/providers");
}

export function getEvidenceTools() {
  return api.get("/automation/evidence/tools");
}

export function getEvidenceAgents() {
  return api.get("/automation/evidence/agents");
}

export function getEvidenceCompanies() {
  return api.get("/automation/evidence/companies");
}

export function getEvidenceConnections() {
  return api.get("/automation/evidence/connections");
}

export function getEvidenceThresholds() {
  return api.get("/automation/evidence/thresholds");
}

export function updateEvidenceThresholds(thresholds) {
  return api.put("/automation/evidence/thresholds", { thresholds, confirm: true });
}

export function getEvidenceReport(id) {
  return api.get(`/automation/evidence/reports/${id}`);
}

export function getEvidenceByShadowEvaluation(shadowEvaluationId) {
  return api.get(
    `/automation/evidence/by-shadow-evaluation/${shadowEvaluationId}`
  );
}

export function testEvidence(data) {
  return api.post("/automation/evidence/test", data);
}
