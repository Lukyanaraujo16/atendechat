import api from "./api";

export const processExecutionFeedback = (payload) =>
  api.post("/automation/feedback/process", payload);

export const listExecutionFeedback = (params) =>
  api.get("/automation/feedback", { params });

export const getExecutionFeedback = (id) =>
  api.get(`/automation/feedback/${id}`);

export const getExecutionFeedbackMetrics = () =>
  api.get("/automation/feedback/metrics");

export const getExecutionFeedbackDashboard = () =>
  api.get("/automation/feedback/dashboard");

export const getExecutionFeedbackConfig = () =>
  api.get("/automation/feedback/config");

export const updateExecutionFeedbackConfig = (config) =>
  api.put("/automation/feedback/config", { config, confirm: true });

export const simulateExecutionFeedback = (payload) =>
  api.post("/automation/feedback/simulate", payload);

export const replayExecutionFeedback = (payload) =>
  api.post("/automation/feedback/replay", payload);
