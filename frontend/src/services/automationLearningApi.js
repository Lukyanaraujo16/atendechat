import api from "./api";

export const analyzeLearning = (payload) =>
  api.post("/automation/learning/analyze", payload);

export const analyzeLearningSession = (sessionId, payload) =>
  api.post(`/automation/learning/analyze/session/${sessionId}`, payload);

export const listLearningCandidates = () =>
  api.get("/automation/learning/candidates");

export const evaluateLearningCandidate = (id) =>
  api.post(`/automation/learning/candidates/${id}/evaluate`);

export const approveLearningCandidate = (id) =>
  api.post(`/automation/learning/candidates/${id}/approve`, { confirm: true });

export const rejectLearningCandidate = (id, reason) =>
  api.post(`/automation/learning/candidates/${id}/reject`, { reason });

export const promoteLearningCandidate = (id, requestedMode = "SHADOW") =>
  api.post(`/automation/learning/candidates/${id}/promote`, { requestedMode, confirm: true });

export const invalidateLearningCandidate = (id, reason) =>
  api.post(`/automation/learning/candidates/${id}/invalidate`, { reason });

export const listLearningArtifacts = () =>
  api.get("/automation/learning/artifacts");

export const rollbackLearningArtifact = (id, reason) =>
  api.post(`/automation/learning/artifacts/${id}/rollback`, { reason, confirm: true });

export const addLearningFeedback = (payload) =>
  api.post("/automation/learning/feedback", payload);

export const runLearningShadow = (payload) =>
  api.post("/automation/learning/shadow", payload);

export const getLearningDashboard = () =>
  api.get("/automation/learning/dashboard");

export const getLearningMetrics = () =>
  api.get("/automation/learning/metrics");

export const getLearningReplay = (id) =>
  api.get(`/automation/learning/replay/${id}`);

export const getLearningConfig = () =>
  api.get("/automation/learning/config");

export const updateLearningConfig = (config) =>
  api.put("/automation/learning/config", { config, confirm: true });

export const listLearningPatterns = () =>
  api.get("/automation/learning/patterns");

export const listLearningDatasets = () =>
  api.get("/automation/learning/datasets");

export const listLearningGuidance = () =>
  api.get("/automation/learning/guidance");

export const simulateLearningQuality = (payload) =>
  api.post("/automation/learning/simulate/quality", payload);

export const simulateLearningConflicts = (payload) =>
  api.post("/automation/learning/simulate/conflicts", payload);

export const simulateLearningPromotion = (payload) =>
  api.post("/automation/learning/simulate/promotion", payload);

export const simulateLearningDecay = (payload) =>
  api.post("/automation/learning/simulate/decay", payload);

export const sanitizeLearningPayload = (payload) =>
  api.post("/automation/learning/sanitize", { payload });
