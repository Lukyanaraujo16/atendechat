/**
 * Fase 2.3 — configuração comercial do Agente de IA.
 */
import React from "react";
import { act, render } from "@testing-library/react";
import {
  getAiAgentProductConfiguration,
  getAiAgentProductConfigurationOptions,
  postAiAgentProductConfiguration,
  putAiAgentProductConfiguration,
  putAiAgentProductConnections,
} from "../aiAgentProductApi";
import api from "../api";
import { useAiAgentProductConfiguration } from "../../hooks/useAiAgentProductConfiguration";
import { mapAiAgentProductConfiguration } from "../../utils/aiAgentProductMapper";

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

let hook;

function ConfigurationHookHarness() {
  hook = useAiAgentProductConfiguration();
  return null;
}

function renderConfigurationHook() {
  render(<ConfigurationHookHarness />);
  return () => hook;
}

describe("Fase 2.3 — Product Configuration API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hook = null;
  });

  it("funções de configuração não enviam companyId", async () => {
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });

    await postAiAgentProductConfiguration({ name: "Bot" });
    await putAiAgentProductConfiguration({ name: "Bot atualizado" });
    await putAiAgentProductConnections({ connectionIds: [1] });

    [api.post.mock.calls[0][1], ...api.put.mock.calls.map((call) => call[1])]
      .forEach((payload) => expect(payload).not.toHaveProperty("companyId"));
  });

  it("funções de configuração não enviam agentId", async () => {
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });

    await postAiAgentProductConfiguration({ name: "Bot" });
    await putAiAgentProductConfiguration({ provider: "openai" });
    await putAiAgentProductConnections({ connectionIds: [2] });

    [api.post.mock.calls[0][1], ...api.put.mock.calls.map((call) => call[1])]
      .forEach((payload) => expect(payload).not.toHaveProperty("agentId"));
  });

  it("não envia campos de runtime enabled, mode ou runtime", async () => {
    api.put.mockResolvedValue({ data: {} });

    await putAiAgentProductConfiguration({
      name: "Bot",
      provider: "openai",
    });

    const payload = api.put.mock.calls[0][1];
    expect(payload).not.toHaveProperty("enabled");
    expect(payload).not.toHaveProperty("mode");
    expect(payload).not.toHaveProperty("runtime");
  });

  it("chama os endpoints corretos da configuração", async () => {
    api.get.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });

    await getAiAgentProductConfiguration();
    await getAiAgentProductConfigurationOptions();
    await postAiAgentProductConfiguration({ name: "Bot" });
    await putAiAgentProductConfiguration({ name: "Bot 2" });
    await putAiAgentProductConnections({ connectionIds: [1, 2] });

    expect(api.get).toHaveBeenNthCalledWith(
      1,
      "/product/ai-agent/configuration"
    );
    expect(api.get).toHaveBeenNthCalledWith(
      2,
      "/product/ai-agent/configuration/options"
    );
    expect(api.post).toHaveBeenCalledWith(
      "/product/ai-agent/configuration",
      { name: "Bot" }
    );
    expect(api.put).toHaveBeenNthCalledWith(
      1,
      "/product/ai-agent/configuration",
      { name: "Bot 2" }
    );
    expect(api.put).toHaveBeenNthCalledWith(
      2,
      "/product/ai-agent/configuration/connections",
      { connectionIds: [1, 2] }
    );
  });

  it("mapeia a resposta de configuração", () => {
    const mapped = mapAiAgentProductConfiguration({
      agentScope: { type: "single", count: 1 },
      configuration: { name: "Bot", provider: "openai" },
      editableWhileActive: true,
      summary: {
        status: "setup_incomplete",
        mode: "off",
        readiness: {
          ready: false,
          status: "setup_incomplete",
          nextAction: "configure_agent",
          checks: [],
        },
      },
    });

    expect(mapped.agentScope).toEqual({ type: "single", count: 1 });
    expect(mapped.configuration).toEqual({
      name: "Bot",
      provider: "openai",
    });
    expect(mapped.editableWhileActive).toBe(true);
    expect(mapped.summary.status).toBe("setup_incomplete");
  });

  it("mapper retorna null para resposta nula", () => {
    expect(mapAiAgentProductConfiguration(null)).toBeNull();
  });

  it("hook carrega a configuração", async () => {
    const response = {
      agentScope: { type: "single", count: 1 },
      configuration: { name: "Bot" },
    };
    api.get.mockResolvedValue({ data: response });
    const current = renderConfigurationHook();

    await act(async () => {
      await current().loadConfiguration();
    });

    expect(current().configuration).toEqual(response);
    expect(current().loading).toBe(false);
    expect(current().error).toBeNull();
  });

  it("hook carrega as opções", async () => {
    const response = {
      providers: [
        { value: "openai", label: "OpenAI", available: true },
        { value: "gemini", label: "Google Gemini", available: true },
      ],
      connections: [{ id: 1, name: "WhatsApp" }],
    };
    api.get.mockResolvedValue({ data: response });
    const current = renderConfigurationHook();

    await act(async () => {
      await current().loadOptions();
    });

    expect(current().options).toEqual(response);
    expect(api.get).toHaveBeenCalledWith(
      "/product/ai-agent/configuration/options"
    );
  });

  it("hook trata erro da API", async () => {
    api.get.mockRejectedValue({
      response: { data: { error: "configuration_invalid" } },
    });
    const current = renderConfigurationHook();

    await act(async () => {
      await current().loadConfiguration();
    });

    expect(current().error).toBe("configuration_invalid");
    expect(current().loading).toBe(false);
  });

  it("nova infraestrutura não chama /automation/* ou /ai-agents/*", async () => {
    api.get.mockResolvedValue({ data: {} });
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });

    await getAiAgentProductConfiguration();
    await getAiAgentProductConfigurationOptions();
    await postAiAgentProductConfiguration({ name: "Bot" });
    await putAiAgentProductConfiguration({ provider: "openai" });
    await putAiAgentProductConnections({ connectionIds: [] });

    [...api.get.mock.calls, ...api.post.mock.calls, ...api.put.mock.calls]
      .map((call) => call[0])
      .forEach((url) => expect(url).not.toMatch(/\/automation\/|\/ai-agents\//));
  });

  it("nenhum payload de request contém companyId", async () => {
    api.post.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });

    await postAiAgentProductConfiguration({
      name: "Bot",
      credentialId: 4,
    });
    await putAiAgentProductConfiguration({
      provider: "openai",
      credentialId: 5,
    });
    await putAiAgentProductConnections({ connectionIds: [7] });

    [...api.post.mock.calls, ...api.put.mock.calls]
      .map((call) => call[1])
      .forEach((payload) => {
        expect(JSON.stringify(payload)).not.toContain("companyId");
      });
  });

  it("resposta de configuração não contém apiKey ou secret", async () => {
    const response = {
      agentScope: { type: "single", count: 1 },
      configuration: { provider: "openai", credentialId: 3 },
    };
    api.get.mockResolvedValue({ data: response });

    const data = await getAiAgentProductConfiguration();

    expect(JSON.stringify(data)).not.toMatch(/apiKey|secret/i);
  });

  it("zero agentes resulta em configuração nula", async () => {
    const response = {
      agentScope: { type: "none", count: 0 },
      configuration: null,
    };
    api.get.mockResolvedValue({ data: response });
    const current = renderConfigurationHook();

    await act(async () => {
      await current().loadConfiguration();
    });

    expect(current().configuration.configuration).toBeNull();
    expect(current().configuration.agentScope.type).toBe("none");
  });

  it("um agente resulta em configuração presente", async () => {
    const response = {
      agentScope: { type: "single", count: 1 },
      configuration: { name: "Bot", provider: "openai" },
    };
    api.get.mockResolvedValue({ data: response });
    const current = renderConfigurationHook();

    await act(async () => {
      await current().loadConfiguration();
    });

    expect(current().configuration.configuration).toEqual(
      expect.objectContaining({ name: "Bot" })
    );
    expect(current().configuration.agentScope.type).toBe("single");
  });

  it("configuração ambígua resulta em estado de erro", async () => {
    api.get.mockRejectedValue({
      response: { data: { error: "ambiguous" } },
    });
    const current = renderConfigurationHook();

    await act(async () => {
      await current().loadConfiguration();
    });

    expect(current().configuration).toBeNull();
    expect(current().error).toBe("ambiguous");
  });
});
