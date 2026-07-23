import api from "./api";

export const executeRuntimeIntegration = (payload) =>
  api.post("/automation/runtime/execute", payload);

export const listRuntimeRequests = (params) =>
  api.get("/automation/runtime/requests", { params });

export const getRuntimeRequest = (id) =>
  api.get(`/automation/runtime/requests/${id}`);

export const getRuntimeIntegrationMetrics = () =>
  api.get("/automation/runtime/metrics");

export const getRuntimePolicies = () =>
  api.get("/automation/runtime/policies");

export const getRuntimeIntegrationDashboard = () =>
  api.get("/automation/runtime/dashboard");

export const getRuntimeIntegrationConfig = () =>
  api.get("/automation/runtime/config");

export const updateRuntimeIntegrationConfig = (config) =>
  api.put("/automation/runtime/config", { config, confirm: true });

export const previewRuntimeRequest = (payload) =>
  api.post("/automation/runtime/preview-request", payload);

export const inspectRuntimeDispatcher = (payload) =>
  api.post("/automation/runtime/inspect-dispatcher", payload);

export const simulateRuntimePolicy = (payload) =>
  api.post("/automation/runtime/simulate-policy", payload);

export const replayRuntimeIntegration = (payload) =>
  api.post("/automation/runtime/replay", payload);
