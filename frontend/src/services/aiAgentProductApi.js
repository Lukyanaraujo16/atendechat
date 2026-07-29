/**
 * Product API client — Agente de IA (Fases 2.0–2.5).
 * Não chama /automation/* nem endpoints técnicos do Console.
 * Mutações comerciais usam apenas POST /product/ai-agent/commands.
 * Simulador comercial: /product/ai-agent/simulator/* (sem agentId).
 */
import api from "./api";

export function getAiAgentProductSummary() {
  return api.get("/product/ai-agent/summary");
}

export function getAiAgentProductReadiness() {
  return api.get("/product/ai-agent/readiness");
}

/**
 * @param {"activate_shadow"|"activate_live"|"deactivate"} command
 */
export function postAiAgentProductCommand(command) {
  return api.post("/product/ai-agent/commands", { command });
}

export async function getAiAgentProductConfiguration() {
  const { data } = await api.get("/product/ai-agent/configuration");
  return data;
}

export async function postAiAgentProductConfiguration(payload) {
  const { data } = await api.post("/product/ai-agent/configuration", payload);
  return data;
}

export async function postAiAgentProductConfigurationPreview(payload) {
  const { data } = await api.post(
    "/product/ai-agent/configuration/preview",
    payload
  );
  return data;
}

export async function putAiAgentProductConfiguration(payload) {
  const { data } = await api.put("/product/ai-agent/configuration", payload);
  return data;
}

export async function getAiAgentProductConfigurationOptions() {
  const { data } = await api.get(
    "/product/ai-agent/configuration/options"
  );
  return data;
}

export async function putAiAgentProductConnections(payload) {
  const { data } = await api.put(
    "/product/ai-agent/configuration/connections",
    payload
  );
  return data;
}

/** Product Simulator (Fase 2.5) — sem agentId. */
export async function getAiAgentProductSimulator() {
  const { data } = await api.get("/product/ai-agent/simulator");
  return data;
}

export async function createAiAgentProductSimulatorSession() {
  const { data } = await api.post("/product/ai-agent/simulator/sessions");
  return data;
}

export async function listAiAgentProductSimulatorSessions(params = {}) {
  const { data } = await api.get("/product/ai-agent/simulator/sessions", {
    params,
  });
  return data;
}

export async function getAiAgentProductSimulatorSession(sessionRef) {
  const { data } = await api.get(
    `/product/ai-agent/simulator/sessions/${encodeURIComponent(sessionRef)}`
  );
  return data;
}

export async function sendAiAgentProductSimulatorMessage(sessionRef, content) {
  const { data } = await api.post(
    `/product/ai-agent/simulator/sessions/${encodeURIComponent(
      sessionRef
    )}/messages`,
    { content }
  );
  return data;
}

export async function endAiAgentProductSimulatorSession(sessionRef) {
  const { data } = await api.post(
    `/product/ai-agent/simulator/sessions/${encodeURIComponent(sessionRef)}/end`
  );
  return data;
}

export async function reviewAiAgentProductSimulatorMessage(messageRef, body) {
  const { data } = await api.post(
    `/product/ai-agent/simulator/messages/${encodeURIComponent(
      messageRef
    )}/review`,
    body
  );
  return data;
}
