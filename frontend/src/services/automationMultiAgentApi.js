import api from "./api";

export const listAgents = () => api.get("/automation/agents");
export const createAgent = (payload) => api.post("/automation/agents", payload);
export const getAgent = (id) => api.get(`/automation/agents/${id}`);
export const updateAgent = (id, payload) =>
  api.put(`/automation/agents/${id}`, { ...payload, confirm: true });
export const deleteAgent = (id) => api.delete(`/automation/agents/${id}`, { params: { confirm: true } });
export const activateAgent = (id) =>
  api.post(`/automation/agents/${id}/activate`);
export const deactivateAgent = (id) =>
  api.post(`/automation/agents/${id}/deactivate`);
export const suspendAgent = (id) =>
  api.post(`/automation/agents/${id}/suspend`);
export const archiveAgent = (id) =>
  api.post(`/automation/agents/${id}/archive`);
export const duplicateAgent = (id, payload) =>
  api.post(`/automation/agents/${id}/duplicate`, payload || {});
export const listAgentVersions = (id) =>
  api.get(`/automation/agents/${id}/versions`);
export const healthAgent = (id, payload) =>
  api.post(`/automation/agents/${id}/health`, payload || {});

export const simulateRouting = (payload) =>
  api.post("/automation/agents/routing/simulate", payload);
export const selectRouting = (payload) =>
  api.post("/automation/agents/routing/select", payload);
export const listRoutingDecisions = () =>
  api.get("/automation/agents/routing/decisions");

export const previewDelegation = (payload) =>
  api.post("/automation/agents/delegations/preview", payload);
export const simulateDelegation = (payload) =>
  api.post("/automation/agents/delegations/simulate", payload);
export const listDelegations = () => api.get("/automation/agents/delegations");

export const previewHandoff = (payload) =>
  api.post("/automation/agents/handoffs/preview", payload);
export const simulateHandoff = (payload) =>
  api.post("/automation/agents/handoffs/simulate", payload);
export const listHandoffs = () => api.get("/automation/agents/handoffs");

export const createCoordination = (payload) =>
  api.post("/automation/agents/coordination/plan", payload);
export const simulateCoordination = (payload) =>
  api.post("/automation/agents/coordination/simulate", payload);

export const sendAgentMessage = (payload) =>
  api.post("/automation/agents/messages", payload);
export const listAgentMessages = () => api.get("/automation/agents/messages");

export const createIntervention = (payload) =>
  api.post("/automation/agents/interventions", payload);
export const listInterventions = () =>
  api.get("/automation/agents/interventions");
export const resolveIntervention = (id, payload) =>
  api.post(`/automation/agents/interventions/${id}/resolve`, payload);

export const getMultiAgentDashboard = () =>
  api.get("/automation/agents/dashboard");
export const getMultiAgentMetrics = () =>
  api.get("/automation/agents/metrics");
export const getMultiAgentReplay = (id) =>
  api.get(`/automation/agents/replay/${id}`);
export const getMultiAgentAudit = () => api.get("/automation/agents/audit");
export const getMultiAgentConfig = () => api.get("/automation/agents/config");
export const updateMultiAgentConfig = (config) =>
  api.put("/automation/agents/config", { config, confirm: true });

export const simulateFullFlow = (payload) =>
  api.post("/automation/agents/simulate/full-flow", payload || {});
export const simulateMemoryPolicy = (payload) =>
  api.post("/automation/agents/simulate/memory", payload);
export const simulateFallback = (payload) =>
  api.post("/automation/agents/simulate/fallback", payload);
export const isolateFailure = (payload) =>
  api.post("/automation/agents/simulate/isolate-failure", payload);

export const listSticky = () => api.get("/automation/agents/sticky");
export const upsertSticky = (payload) =>
  api.post("/automation/agents/sticky", payload);
