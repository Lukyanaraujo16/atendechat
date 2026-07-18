import api from "./api";

export function getAutomationOrchestratorDashboard(params = {}) {
  return api.get("/automation/orchestrator/dashboard", { params });
}

export function listAutomationExecutions(params = {}) {
  return api.get("/automation/orchestrator/executions", { params });
}

export function getAutomationExecution(id) {
  return api.get(`/automation/orchestrator/executions/${id}`);
}

export function getAutomationExecutionReplay(id) {
  return api.get(`/automation/orchestrator/executions/${id}/replay`);
}

export function continueAutomationExecution(id, data = {}) {
  return api.post(`/automation/orchestrator/executions/${id}/continue`, data);
}

export function listAutomationActions() {
  return api.get("/automation/orchestrator/actions");
}

export function simulateAutomationPlan(data = {}) {
  return api.post("/automation/orchestrator/simulate", data);
}

export function getAutomationOrchestratorSettings(params = {}) {
  return api.get("/automation/orchestrator/settings", { params });
}

export function updateAutomationOrchestratorSettings(data = {}) {
  return api.put("/automation/orchestrator/settings", data);
}

export function listAutomationPlannerValidations(params = {}) {
  return api.get("/automation/orchestrator/validations", { params });
}

export function getAutomationActivationMetrics(params = {}) {
  return api.get("/automation/orchestrator/activation-metrics", { params });
}
