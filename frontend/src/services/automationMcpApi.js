import api from "./api";

export const listMcpServers = () => api.get("/automation/mcp/servers");

export const createMcpServer = (payload) =>
  api.post("/automation/mcp/servers", payload);

export const updateMcpServer = (id, payload) =>
  api.put(`/automation/mcp/servers/${id}`, { ...payload, confirm: true });

export const deleteMcpServer = (id) =>
  api.delete(`/automation/mcp/servers/${id}`, { params: { confirm: true } });

export const testMcpServer = (id) =>
  api.post(`/automation/mcp/servers/${id}/test`);

export const healthMcpServer = (id) =>
  api.post(`/automation/mcp/servers/${id}/health`);

export const connectMcpServer = (id) =>
  api.post(`/automation/mcp/servers/${id}/connect`);

export const disconnectMcpServer = (id) =>
  api.post(`/automation/mcp/servers/${id}/disconnect`);

export const syncMcpServer = (id) =>
  api.post(`/automation/mcp/servers/${id}/sync`);

export const listMcpServerTools = (id) =>
  api.get(`/automation/mcp/servers/${id}/tools`);

export const listMcpTools = (params) =>
  api.get("/automation/mcp/tools", { params });

export const getMcpTool = (serverId, toolName) =>
  api.get(`/automation/mcp/tools/${serverId}/${toolName}`);

export const updateMcpTool = (serverId, toolName, payload) =>
  api.put(`/automation/mcp/tools/${serverId}/${toolName}`, { ...payload, confirm: true });

export const previewMcpTool = (payload) =>
  api.post("/automation/mcp/preview", payload);

export const executeMcpTool = (payload) =>
  api.post("/automation/mcp/execute", payload);

export const confirmMcpTool = (payload) =>
  api.post("/automation/mcp/confirm", payload);

export const listMcpExecutions = (params) =>
  api.get("/automation/mcp/executions", { params });

export const getMcpExecution = (id) =>
  api.get(`/automation/mcp/executions/${id}`);

export const getMcpMetrics = () => api.get("/automation/mcp/metrics");

export const getMcpDashboard = () => api.get("/automation/mcp/dashboard");

export const replayMcpRuntime = (payload) =>
  api.post("/automation/mcp/replay", payload);

export const getMcpReplay = (id) => api.get(`/automation/mcp/replay/${id}`);

export const getMcpConfig = () => api.get("/automation/mcp/config");

export const updateMcpConfig = (config) =>
  api.put("/automation/mcp/config", { config, confirm: true });

export const listMcpCredentials = () =>
  api.get("/automation/mcp/credentials");

export const createMcpCredential = (payload) =>
  api.post("/automation/mcp/credentials", payload);

export const simulateMcpPolicy = (payload) =>
  api.post("/automation/mcp/simulate-policy", payload);

export const simulateMcpFallback = (payload) =>
  api.post("/automation/mcp/simulate-fallback", payload);

export const normalizeMcpResult = (payload) =>
  api.post("/automation/mcp/normalize-result", payload);

export const inspectMcpDispatch = (payload) =>
  api.post("/automation/mcp/inspect-dispatch", payload);
