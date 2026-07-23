import api from "./api";

export function getObservabilityDashboard() {
  return api.get("/automation/observability/dashboard");
}

export function getObservabilityHealth() {
  return api.get("/automation/observability/health");
}

export function getObservabilityMetrics() {
  return api.get("/automation/observability/metrics");
}

export function getObservabilityTrace(traceId) {
  return api.get(`/automation/observability/trace/${traceId}`);
}

export function getObservabilityTimeline(traceId) {
  return api.get(`/automation/observability/timeline/${traceId}`);
}

export function listObservabilityEvents(params = {}) {
  return api.get("/automation/observability/events", { params });
}

export function listObservabilityAlerts() {
  return api.get("/automation/observability/alerts");
}

export function acknowledgeObservabilityAlert(alertId) {
  return api.post(`/automation/observability/alerts/${alertId}/acknowledge`, {
    confirm: true,
  });
}

export function exportObservability(params = {}) {
  return api.get("/automation/observability/export", { params });
}

export function runObservabilityOps(data) {
  return api.post("/automation/observability/ops", { ...data, confirm: true });
}

export function getObservabilityConfig() {
  return api.get("/automation/observability/config");
}

export function updateObservabilityConfig(config) {
  return api.put("/automation/observability/config", { config, confirm: true });
}

export function probeObservability(data = {}) {
  return api.post("/automation/observability/probe", data);
}
