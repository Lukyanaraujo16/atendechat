import api from "./api";

export function getAutomationToolsCatalog() {
  return api.get("/automation/tools/catalog");
}

export function listAutomationToolExecutions(params = {}) {
  return api.get("/automation/tools/executions", { params });
}

export function getAutomationToolExecution(id) {
  return api.get(`/automation/tools/executions/${id}`);
}

export function testAutomationTool(toolId, data = {}) {
  return api.post(`/automation/tools/test/${toolId}`, data);
}

export function getAutomationToolPolicies() {
  return api.get("/automation/tools/policies");
}

export function updateAutomationToolPolicies(data = {}) {
  return api.put("/automation/tools/policies", data);
}

export function getAutomationToolMetrics() {
  return api.get("/automation/tools/metrics");
}
