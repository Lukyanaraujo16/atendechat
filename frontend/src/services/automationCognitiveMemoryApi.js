import api from "./api";

export const createCognitiveMemory = (payload) =>
  api.post("/automation/memory", payload);

export const listCognitiveMemory = (params) =>
  api.get("/automation/memory", { params });

export const getCognitiveMemory = (id) =>
  api.get(`/automation/memory/${id}`);

export const queryCognitiveMemory = (payload) =>
  api.post("/automation/memory/query", payload);

export const getCognitiveMemoryMetrics = () =>
  api.get("/automation/memory/metrics");

export const getCognitiveMemoryDashboard = () =>
  api.get("/automation/memory/dashboard");

export const getCognitiveMemoryConfig = () =>
  api.get("/automation/memory/config");

export const updateCognitiveMemoryConfig = (config) =>
  api.put("/automation/memory/config", { config, confirm: true });

export const buildCognitiveKnowledge = (payload) =>
  api.post("/automation/memory/build-knowledge", payload);

export const replayCognitiveMemory = (payload) =>
  api.post("/automation/memory/replay", payload);
