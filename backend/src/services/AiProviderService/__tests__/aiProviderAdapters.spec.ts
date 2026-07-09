jest.mock("../../OpenAi/OpenAiManager", () => ({
  executeOpenAi: jest.fn()
}));

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn()
}));

import { executeOpenAi } from "../../OpenAi/OpenAiManager";
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAiProviderAdapter from "../OpenAiProviderAdapter";
import GeminiProviderAdapter from "../GeminiProviderAdapter";
import { getAiProviderAdapter } from "../AiProviderAdapterFactory";
import {
  validateOpenAiApiKeyFormat,
  validateGeminiApiKeyFormat,
  parseProvider
} from "../../AiProviderCredentialService/aiProviderCredentialValidation";
import { parseAiAgentModelForProvider } from "../../AiAgentService/aiAgentValidation";
import { mapGeminiErrorToShadowCode } from "../aiProviderErrors";
import { AI_AGENT_SHADOW_ERROR_CODES } from "../../AiAgentService/aiAgentShadowErrors";

const mockedExecuteOpenAi = executeOpenAi as jest.Mock;
const MockedGoogleGenerativeAI = GoogleGenerativeAI as jest.Mock;

describe("AiProvider multi-provider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("credential validation", () => {
    it("OpenAI continua exigindo sk-", () => {
      expect(() => validateOpenAiApiKeyFormat("AIza12345678901234567890")).toThrow();
      expect(validateOpenAiApiKeyFormat("sk-testkey1234567890")).toBe(
        "sk-testkey1234567890"
      );
    });

    it("Gemini não usa regex sk-", () => {
      expect(() => validateGeminiApiKeyFormat("sk-testkey1234567890")).toThrow();
      expect(
        validateGeminiApiKeyFormat("AIzaSyTestKey123456789012345")
      ).toBe("AIzaSyTestKey123456789012345");
    });

    it("aceita provider gemini", () => {
      expect(parseProvider("gemini")).toBe("gemini");
    });

    it("rejeita provider inválido", () => {
      expect(() => parseProvider("anthropic")).toThrow();
    });
  });

  describe("model validation by provider", () => {
    it("modelo Gemini inválido para OpenAI", () => {
      expect(() =>
        parseAiAgentModelForProvider("gemini-2.5-flash", "openai")
      ).toThrow();
    });

    it("modelo OpenAI inválido para Gemini", () => {
      expect(() => parseAiAgentModelForProvider("gpt-4o-mini", "gemini")).toThrow();
    });

    it("modelo Gemini válido", () => {
      expect(parseAiAgentModelForProvider("gemini-2.5-flash", "gemini")).toBe(
        "gemini-2.5-flash"
      );
    });
  });

  describe("OpenAiProviderAdapter", () => {
    const adapter = new OpenAiProviderAdapter();

    it("encapsula executeOpenAi", async () => {
      mockedExecuteOpenAi.mockResolvedValue({
        ok: true,
        content: "Resposta",
        tokensUsed: 10,
        promptTokens: 6,
        completionTokens: 4
      });

      const result = await adapter.generateChatCompletion({
        companyId: 1,
        ticketId: 2,
        apiKey: "sk-testkey1234567890",
        model: "gpt-4o-mini",
        temperature: 0.3,
        maxTokens: 128,
        systemPrompt: "sys",
        messages: [{ role: "user", content: "oi" }],
        timeoutMs: 5000,
        source: "ai_agent_shadow"
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.provider).toBe("openai");
        expect(result.text).toBe("Resposta");
      }
    });
  });

  describe("GeminiProviderAdapter", () => {
    const adapter = new GeminiProviderAdapter();

    it("chama SDK mockado", async () => {
      const generateContent = jest.fn().mockResolvedValue({
        response: {
          text: () => "Olá Gemini",
          usageMetadata: {
            promptTokenCount: 5,
            candidatesTokenCount: 3,
            totalTokenCount: 8
          }
        }
      });
      const getGenerativeModel = jest.fn().mockReturnValue({ generateContent });
      MockedGoogleGenerativeAI.mockImplementation(() => ({ getGenerativeModel }));

      const result = await adapter.generateChatCompletion({
        companyId: 1,
        apiKey: "AIzaSyTestKey123456789012345",
        model: "gemini-2.5-flash",
        temperature: 0.2,
        maxTokens: 64,
        systemPrompt: "Seja breve",
        messages: [{ role: "user", content: "oi" }],
        timeoutMs: 5000,
        source: "ai_agent_shadow"
      });

      expect(MockedGoogleGenerativeAI).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.provider).toBe("gemini");
        expect(result.text).toBe("Olá Gemini");
      }
    });

    it("auth error vira ai_auth_error", () => {
      expect(
        mapGeminiErrorToShadowCode({ status: 401, message: "invalid api key" })
      ).toBe(AI_AGENT_SHADOW_ERROR_CODES.AI_AUTH_ERROR);
    });

    it("quota error vira rate_limited", () => {
      expect(
        mapGeminiErrorToShadowCode({ status: 429, message: "quota exceeded" })
      ).toBe(AI_AGENT_SHADOW_ERROR_CODES.AI_USAGE_LIMIT_REACHED);
    });

    it("modelo inválido", () => {
      expect(
        mapGeminiErrorToShadowCode({ status: 400, message: "model not found" })
      ).toBe(AI_AGENT_SHADOW_ERROR_CODES.INVALID_MODEL);
    });

    it("resposta vazia", async () => {
      const generateContent = jest.fn().mockResolvedValue({
        response: { text: () => "   " }
      });
      MockedGoogleGenerativeAI.mockImplementation(() => ({
        getGenerativeModel: () => ({ generateContent })
      }));

      const result = await adapter.generateChatCompletion({
        companyId: 1,
        apiKey: "AIzaSyTestKey123456789012345",
        model: "gemini-2.5-flash",
        temperature: 0.2,
        maxTokens: 64,
        systemPrompt: "sys",
        messages: [{ role: "user", content: "oi" }],
        timeoutMs: 5000,
        source: "ai_agent_shadow"
      });

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe(AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE);
      }
    });
  });

  describe("factory", () => {
    it("retorna adapter Gemini", () => {
      expect(getAiProviderAdapter("gemini").provider).toBe("gemini");
    });

    it("retorna adapter OpenAI", () => {
      expect(getAiProviderAdapter("openai").provider).toBe("openai");
    });
  });
});
