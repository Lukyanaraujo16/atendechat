import api from "./api";

export const executeAction = (payload) =>
  api.post("/automation/actions/execute", payload);

export const listActionStrategies = () =>
  api.get("/automation/actions/strategies");

export const listActionResults = (params) =>
  api.get("/automation/actions/results", { params });

export const getActionResult = (id) =>
  api.get(`/automation/actions/results/${id}`);

export const getActionExecutionDashboard = () =>
  api.get("/automation/actions/dashboard");

export const getActionExecutionMetrics = () =>
  api.get("/automation/actions/metrics");

export const getActionExecutionConfig = () =>
  api.get("/automation/actions/config");

export const updateActionExecutionConfig = (config) =>
  api.put("/automation/actions/config", { config, confirm: true });

export const replayActionExecution = (payload) =>
  api.post("/automation/actions/replay", payload);

export const simulateAction = (payload) =>
  api.post("/automation/actions/simulate", payload);

export const inspectActionStrategy = (payload) =>
  api.post("/automation/actions/inspect-strategy", payload);
