import api from "./api";

export function getExecutionSessionsDashboard() {
  return api.get("/automation/execution/dashboard");
}

export function getExecutionOrchestratorMetrics() {
  return api.get("/automation/execution/metrics");
}

export function getExecutionOrchestratorConfig() {
  return api.get("/automation/execution/config");
}

export function updateExecutionOrchestratorConfig(config) {
  return api.put("/automation/execution/config", { config, confirm: true });
}

export function createExecutionSession(data) {
  return api.post("/automation/execution/session", data);
}

export function startExecutionSession(data) {
  return api.post("/automation/execution/start", data);
}

export function pauseExecutionSession(data) {
  return api.post("/automation/execution/pause", data);
}

export function resumeExecutionSession(data) {
  return api.post("/automation/execution/resume", data);
}

export function abortExecutionSession(data) {
  return api.post("/automation/execution/abort", data);
}

export function advanceExecutionSession(data) {
  return api.post("/automation/execution/advance", data);
}

export function listExecutionSessions(params = {}) {
  return api.get("/automation/execution/sessions", { params });
}

export function getExecutionSession(id) {
  return api.get(`/automation/execution/sessions/${id}`);
}

export function replayExecutionSession(data) {
  return api.post("/automation/execution/replay", data);
}

export function getExecutionReplay(id) {
  return api.get(`/automation/execution/replay/${id}`);
}

export function simulateExecutionTransition(data) {
  return api.post("/automation/execution/simulate/transition", data);
}

export function inspectExecutionGraph(data) {
  return api.post("/automation/execution/graph", data);
}

export function simulateExecutionRecovery(data) {
  return api.post("/automation/execution/simulate/recovery", data);
}
