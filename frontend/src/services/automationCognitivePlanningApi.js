import api from "./api";

export function getCognitivePlanningDashboard() {
  return api.get("/automation/planning/dashboard");
}

export function getCognitivePlanningMetrics() {
  return api.get("/automation/planning/metrics");
}

export function analyzeCognitiveGoal(data) {
  return api.post("/automation/planning/analyze-goal", data);
}

export function generateCognitivePlan(data) {
  return api.post("/automation/planning/generate-plan", data);
}

export function inspectCognitiveDependencies(data = {}) {
  return api.post("/automation/planning/dependencies", data);
}

export function simulateCognitiveValidation(data) {
  return api.post("/automation/planning/validate", data);
}

export function simulateCognitiveRecovery(data) {
  return api.post("/automation/planning/recovery", data);
}

export function replayCognitivePlan(data) {
  return api.post("/automation/planning/replay", data);
}

export function evaluateCognitivePlan(data) {
  return api.post("/automation/planning/evaluate", data);
}

export function listPlanEvaluations(params = {}) {
  return api.get("/automation/planning/evaluations", { params });
}

export function getPlanEvaluation(id) {
  return api.get(`/automation/planning/evaluations/${id}`);
}

export function getPlanEvaluationDashboard() {
  return api.get("/automation/planning/evaluation/dashboard");
}

export function getPlanEvaluationConfig() {
  return api.get("/automation/planning/evaluation/config");
}

export function updatePlanEvaluationConfig(config) {
  return api.put("/automation/planning/evaluation/config", { config, confirm: true });
}

export function diffCognitivePlans(data) {
  return api.post("/automation/planning/diff", data);
}
