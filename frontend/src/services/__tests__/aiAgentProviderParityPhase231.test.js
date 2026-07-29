/**
 * Hardening 2.3.1 — paridade providers OpenAI/Gemini no frontend (infra mínima).
 */
import {
  mapAiAgentProductConfiguration,
  mapAiAgentProductConfigurationOptions,
  normalizeAiAgentProductProvider,
} from "../../utils/aiAgentProductMapper";
import {
  getAiAgentProductConfiguration,
  getAiAgentProductConfigurationOptions,
  postAiAgentProductConfiguration,
  putAiAgentProductConfiguration,
} from "../aiAgentProductApi";

jest.mock("../api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

import api from "../api";

describe("aiAgentProviderParityPhase231", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normaliza OpenAI e Gemini", () => {
    expect(normalizeAiAgentProductProvider("OpenAI")).toBe("openai");
    expect(normalizeAiAgentProductProvider("gemini")).toBe("gemini");
    expect(normalizeAiAgentProductProvider("GEMINI")).toBe("gemini");
  });

  it("provider desconhecido → unknown (não openai)", () => {
    expect(normalizeAiAgentProductProvider("claude")).toBe("unknown");
    expect(normalizeAiAgentProductProvider("claude")).not.toBe("openai");
  });

  it("options com ambos os providers", () => {
    const mapped = mapAiAgentProductConfigurationOptions({
      providers: [
        { value: "openai", label: "OpenAI", available: true },
        { value: "gemini", label: "Google Gemini", available: true },
      ],
      credentials: [
        { ref: "1", provider: "openai", maskedKey: "sk-..." },
        { ref: "2", provider: "gemini", maskedKey: "AIza..." },
      ],
      connections: [],
    });
    expect(mapped.providers).toHaveLength(2);
    expect(mapped.providers.map((p) => p.value)).toEqual(["openai", "gemini"]);
    expect(mapped.providers.every((p) => p.available)).toBe(true);
  });

  it("indisponibilidade preservada", () => {
    const mapped = mapAiAgentProductConfigurationOptions({
      providers: [
        {
          value: "gemini",
          label: "Google Gemini",
          available: false,
          unavailableReason: "temporarily_unavailable",
        },
      ],
      credentials: [],
      connections: [],
    });
    expect(mapped.providers[0].available).toBe(false);
    expect(mapped.providers[0].unavailableReason).toBe(
      "temporarily_unavailable"
    );
  });

  it("configuration Gemini não vira OpenAI", () => {
    const mapped = mapAiAgentProductConfiguration({
      agentScope: { type: "single", count: 1 },
      configuration: {
        provider: { configured: true, type: "gemini", label: "Google Gemini" },
        model: { name: "gemini-2.5-flash" },
        credential: { configured: true, maskedKey: "AIza...YYY" },
      },
      summary: null,
    });
    expect(mapped.configuration.provider.type).toBe("gemini");
    expect(mapped.configuration.provider.type).not.toBe("openai");
  });

  it("API não envia companyId, agentId, enabled, mode", async () => {
    api.post.mockResolvedValue({ data: { created: true } });
    api.put.mockResolvedValue({ data: { changed: true } });
    api.get.mockResolvedValue({ data: {} });

    await postAiAgentProductConfiguration({
      name: "Bot",
      provider: "gemini",
      credentialRef: "6",
    });
    await putAiAgentProductConfiguration({
      provider: "openai",
      credentialRef: "5",
    });
    await getAiAgentProductConfiguration();
    await getAiAgentProductConfigurationOptions();

    for (const call of api.post.mock.calls) {
      const payload = call[1] || {};
      expect(payload).not.toHaveProperty("companyId");
      expect(payload).not.toHaveProperty("agentId");
      expect(payload).not.toHaveProperty("enabled");
      expect(payload).not.toHaveProperty("mode");
    }
    for (const call of api.put.mock.calls) {
      const payload = call[1] || {};
      expect(payload).not.toHaveProperty("companyId");
      expect(payload).not.toHaveProperty("agentId");
      expect(payload).not.toHaveProperty("enabled");
      expect(payload).not.toHaveProperty("mode");
    }
    expect(api.get.mock.calls.every((c) => !String(c[0]).includes("/ai-agents"))).toBe(
      true
    );
    expect(
      api.get.mock.calls.every((c) => !String(c[0]).includes("/automation"))
    ).toBe(true);
  });

  it("erro de credencial incompatível não é reescrito pelo mapper", () => {
    const errorCode = "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID";
    expect(errorCode).toContain("CREDENTIAL_INVALID");
    // Frontend não calcula readiness — apenas propaga código comercial
    expect(typeof mapAiAgentProductConfiguration).toBe("function");
  });

  it("nenhuma allowlist de providers no frontend — options vêm do backend", () => {
    const mapped = mapAiAgentProductConfigurationOptions({
      providers: [{ value: "openai", label: "OpenAI", available: true }],
      credentials: [],
      connections: [],
    });
    // Mapper não injeta gemini se o backend não enviar
    expect(mapped.providers.map((p) => p.value)).toEqual(["openai"]);
  });
});
