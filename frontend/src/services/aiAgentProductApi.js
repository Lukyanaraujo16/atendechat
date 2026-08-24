/**
 * Product API client — Agente de IA (Fases 2.0–2.9B).
 * Não chama /automation/* nem endpoints técnicos do Console.
 * Operações agent-scoped aceitam agentRef (string opaca).
 */
import api from "./api";

function withAgentRefParams(agentRef, params = {}) {
  const ref = agentRef != null ? String(agentRef).trim() : "";
  if (!ref) return params;
  return { ...params, agentRef: ref };
}

function withAgentRefBody(agentRef, body = {}) {
  const ref = agentRef != null ? String(agentRef).trim() : "";
  if (!ref) return body;
  return { ...body, agentRef: ref };
}

function agentScopedPath(agentRef, suffix = "") {
  const ref = String(agentRef || "").trim();
  if (!ref) return `/product/ai-agent${suffix}`;
  return `/product/ai-agent/agents/${encodeURIComponent(ref)}${suffix}`;
}

function optionalParams(agentRef, params = {}) {
  const merged = withAgentRefParams(agentRef, params);
  return Object.keys(merged).length ? { params: merged } : undefined;
}

function optionalBody(agentRef, body = {}) {
  const merged = withAgentRefBody(agentRef, body);
  return Object.keys(merged).length ? merged : undefined;
}

/** Listagem comercial multiagente (Fase 2.9A/B). */
export async function listAiAgentProductAgents() {
  const { data } = await api.get("/product/ai-agent/agents");
  const agents = Array.isArray(data?.agents)
    ? data.agents
    : Array.isArray(data)
      ? data
      : [];
  return {
    agents: agents.map((item) => ({
      agentRef: String(item?.agentRef ?? ""),
      name: String(item?.name || ""),
      enabled: item?.enabled === true,
      provider: item?.provider != null ? String(item.provider) : null,
      model: item?.model != null ? String(item.model) : null,
      operationMode:
        item?.operationMode != null ? String(item.operationMode) : "off",
      status:
        item?.status != null ? String(item.status) : "setup_incomplete",
      ready: item?.ready === true,
      connectionCount: Number(item?.connectionCount) || 0,
      createdAt: item?.createdAt || null,
      updatedAt: item?.updatedAt || null,
    })),
  };
}

export function getAiAgentProductSummary(agentRef) {
  const ref = agentRef != null ? String(agentRef).trim() : "";
  if (ref) {
    return api.get(agentScopedPath(ref, "/summary"));
  }
  return api.get("/product/ai-agent/summary");
}

export function getAiAgentProductReadiness(agentRef) {
  const ref = agentRef != null ? String(agentRef).trim() : "";
  if (ref) {
    return api.get(agentScopedPath(ref, "/readiness"));
  }
  return api.get("/product/ai-agent/readiness");
}

/**
 * @param {"activate_shadow"|"activate_live"|"deactivate"} command
 * @param {string} [agentRef]
 */
export function postAiAgentProductCommand(command, agentRef) {
  const ref = agentRef != null ? String(agentRef).trim() : "";
  if (ref) {
    return api.post(agentScopedPath(ref, "/commands"), { command });
  }
  return api.post("/product/ai-agent/commands", { command });
}

export function postAiAgentProductArchive(agentRef) {
  const ref = agentRef != null ? String(agentRef).trim() : "";
  return api.post(agentScopedPath(ref, "/archive"));
}

export async function getAiAgentProductConfiguration(agentRef) {
  const ref = agentRef != null ? String(agentRef).trim() : "";
  if (ref) {
    const { data } = await api.get(agentScopedPath(ref, "/configuration"));
    return data;
  }
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

export async function putAiAgentProductConfiguration(payload, agentRef) {
  const ref =
    agentRef != null
      ? String(agentRef).trim()
      : payload?.agentRef != null
        ? String(payload.agentRef).trim()
        : "";
  const body = { ...(payload || {}) };
  delete body.agentRef;
  if (ref) {
    const { data } = await api.put(
      agentScopedPath(ref, "/configuration"),
      body
    );
    return data;
  }
  const { data } = await api.put("/product/ai-agent/configuration", body);
  return data;
}

export async function getAiAgentProductConfigurationOptions(agentRef) {
  const config = optionalParams(agentRef);
  const { data } = config
    ? await api.get("/product/ai-agent/configuration/options", config)
    : await api.get("/product/ai-agent/configuration/options");
  return data;
}

export async function putAiAgentProductConnections(payload, agentRef) {
  const ref =
    agentRef != null
      ? String(agentRef).trim()
      : payload?.agentRef != null
        ? String(payload.agentRef).trim()
        : "";
  const body = { ...(payload || {}) };
  delete body.agentRef;
  if (ref) {
    const { data } = await api.put(
      agentScopedPath(ref, "/configuration/connections"),
      body
    );
    return data;
  }
  const { data } = await api.put(
    "/product/ai-agent/configuration/connections",
    body
  );
  return data;
}

/** Knowledge agent-scoped (Fase 2.10). */
export async function getAiAgentProductKnowledge(agentRef) {
  const ref = String(agentRef || "").trim();
  if (!ref) {
    throw new Error("agentRef required");
  }
  const { data } = await api.get(agentScopedPath(ref, "/knowledge"));
  return data;
}

export async function putAiAgentProductKnowledge(payload, agentRef) {
  const ref = String(agentRef || "").trim();
  if (!ref) {
    throw new Error("agentRef required");
  }
  const body = { ...(payload || {}) };
  delete body.agentRef;
  const { data } = await api.put(agentScopedPath(ref, "/knowledge"), body);
  return data;
}

/** Product Credentials (Fase 2.7) — escopo company. */
export async function listAiAgentProductCredentials() {
  const { data } = await api.get("/product/ai-agent/credentials");
  return data;
}

export async function getAiAgentProductCredential(credentialRef) {
  const { data } = await api.get(
    `/product/ai-agent/credentials/${encodeURIComponent(credentialRef)}`
  );
  return data;
}

export async function createAiAgentProductCredential({
  name,
  provider,
  apiKey,
  isDefault,
} = {}) {
  const payload = { name, provider, apiKey };
  if (isDefault !== undefined) payload.isDefault = isDefault;
  const { data } = await api.post("/product/ai-agent/credentials", payload);
  return data;
}

export async function updateAiAgentProductCredential(
  credentialRef,
  { name, provider, apiKey, isDefault } = {}
) {
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (provider !== undefined) payload.provider = provider;
  if (apiKey !== undefined && String(apiKey).trim() !== "") {
    payload.apiKey = String(apiKey).trim();
  }
  if (isDefault !== undefined) payload.isDefault = isDefault;
  const { data } = await api.put(
    `/product/ai-agent/credentials/${encodeURIComponent(credentialRef)}`,
    payload
  );
  return data;
}

export async function testAiAgentProductCredential(credentialRef) {
  const { data } = await api.post(
    `/product/ai-agent/credentials/${encodeURIComponent(credentialRef)}/test`
  );
  return data;
}

export async function enableAiAgentProductCredential(credentialRef) {
  const { data } = await api.post(
    `/product/ai-agent/credentials/${encodeURIComponent(credentialRef)}/enable`
  );
  return data;
}

export async function disableAiAgentProductCredential(credentialRef) {
  const { data } = await api.post(
    `/product/ai-agent/credentials/${encodeURIComponent(credentialRef)}/disable`
  );
  return data;
}

/** Product Simulator — transporta agentRef quando informado (2.9B/C). */
export async function getAiAgentProductSimulator(agentRef) {
  const config = optionalParams(agentRef);
  const { data } = config
    ? await api.get("/product/ai-agent/simulator", config)
    : await api.get("/product/ai-agent/simulator");
  return data;
}

export async function createAiAgentProductSimulatorSession(agentRef) {
  const body = optionalBody(agentRef);
  const { data } = body
    ? await api.post("/product/ai-agent/simulator/sessions", body)
    : await api.post("/product/ai-agent/simulator/sessions");
  return data;
}

export async function listAiAgentProductSimulatorSessions(
  params = {},
  agentRef
) {
  const config = optionalParams(agentRef, params);
  const { data } = config
    ? await api.get("/product/ai-agent/simulator/sessions", config)
    : await api.get("/product/ai-agent/simulator/sessions");
  return data;
}

export async function getAiAgentProductSimulatorSession(sessionRef, agentRef) {
  const config = optionalParams(agentRef);
  const url = `/product/ai-agent/simulator/sessions/${encodeURIComponent(
    sessionRef
  )}`;
  const { data } = config ? await api.get(url, config) : await api.get(url);
  return data;
}

export async function sendAiAgentProductSimulatorMessage(
  sessionRef,
  content,
  agentRef
) {
  const { data } = await api.post(
    `/product/ai-agent/simulator/sessions/${encodeURIComponent(
      sessionRef
    )}/messages`,
    withAgentRefBody(agentRef, { content })
  );
  return data;
}

export async function endAiAgentProductSimulatorSession(sessionRef, agentRef) {
  const body = optionalBody(agentRef);
  const url = `/product/ai-agent/simulator/sessions/${encodeURIComponent(
    sessionRef
  )}/end`;
  const { data } = body ? await api.post(url, body) : await api.post(url);
  return data;
}

export async function reviewAiAgentProductSimulatorMessage(
  messageRef,
  body,
  agentRef
) {
  const { data } = await api.post(
    `/product/ai-agent/simulator/messages/${encodeURIComponent(
      messageRef
    )}/review`,
    withAgentRefBody(agentRef, body)
  );
  return data;
}
