/**
 * Testes de integração leve (mocks) para Simulador/Shadow/Live + RAG.
 * Não chamam WhatsApp/providers reais.
 */

jest.mock("../../../../libs/cache", () => ({
  setNx: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(1)
}));

jest.mock("../RetrieveKnowledgeForAgentService", () => ({
  __esModule: true,
  default: jest.fn()
}));

import { setNx, del } from "../../../../libs/cache";
import {
  acquireAiAgentGenerationLock,
  releaseAiAgentGenerationLock
} from "../aiAgentGenerationLock";
import { applyKnowledgeToSystemPrompt } from "../integrateKnowledgeIntoRuntime";
import RetrieveKnowledgeForAgentService from "../RetrieveKnowledgeForAgentService";

describe("AI Agent Knowledge channel integration hardening", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (setNx as jest.Mock).mockResolvedValue(true);
  });

  it("acquires and releases redis generation lock", async () => {
    const lock = await acquireAiAgentGenerationLock({
      channel: "live",
      companyId: 1,
      logId: 99
    });
    expect(lock.acquired).toBe(true);
    expect(lock.key).toContain("ai-agent:live:gen:1:99");
    expect(setNx).toHaveBeenCalled();
    await releaseAiAgentGenerationLock(lock.key);
    expect(del).toHaveBeenCalledWith(lock.key);
  });

  it("fail-open lock when redis throws", async () => {
    (setNx as jest.Mock).mockRejectedValueOnce(new Error("redis down"));
    const lock = await acquireAiAgentGenerationLock({
      channel: "shadow",
      companyId: 1,
      logId: 2
    });
    expect(lock.acquired).toBe(true);
    expect(lock.redisUnavailable).toBe(true);
  });

  it("simulator-like: channel disabled → skip without knowledge block", () => {
    const applied = applyKnowledgeToSystemPrompt("SYS", {
      enabled: true,
      performed: false,
      skippedReason: "channel_disabled",
      status: "skipped",
      queryUsed: "",
      results: [],
      contextText: "<knowledge_context>x</knowledge_context>",
      sources: [],
      metrics: {
        durationMs: 0,
        embeddingDurationMs: 0,
        searchDurationMs: 0,
        candidateCount: 0,
        returnedChunkCount: 0,
        returnedDocumentCount: 0,
        estimatedContextTokens: 0,
        contextCharacters: 0,
        provider: "",
        model: "",
        dimensions: 0,
        truncated: false
      },
      knowledgeMissing: true,
      suggestHandoff: false,
      allowAnswerWithoutKnowledge: true
    });
    expect(applied.decision.decision).toBe("skip");
    expect(applied.systemPrompt).toBe("SYS");
  });

  it("live-like: knowledge missing + handoff → single handoff decision", () => {
    const applied = applyKnowledgeToSystemPrompt("SYS", {
      enabled: true,
      performed: true,
      skippedReason: null,
      status: "empty",
      queryUsed: "preço",
      results: [],
      contextText: "",
      sources: [],
      metrics: {
        durationMs: 10,
        embeddingDurationMs: 1,
        searchDurationMs: 1,
        candidateCount: 0,
        returnedChunkCount: 0,
        returnedDocumentCount: 0,
        estimatedContextTokens: 0,
        contextCharacters: 0,
        provider: "openai",
        model: "m",
        dimensions: 1536,
        truncated: false
      },
      knowledgeMissing: true,
      suggestHandoff: true,
      allowAnswerWithoutKnowledge: false
    });
    expect(applied.forceHandoff).toBe(true);
    expect(applied.decision.decision).toBe("handoff");
    expect(applied.systemPrompt).not.toContain("<knowledge_context>");
  });

  it("retrieve mock is callable for integration wiring", async () => {
    (RetrieveKnowledgeForAgentService as jest.Mock).mockResolvedValue({
      enabled: false,
      performed: false,
      skippedReason: "disabled",
      status: "skipped",
      queryUsed: "",
      results: [],
      contextText: "",
      sources: [],
      metrics: {
        durationMs: 0,
        embeddingDurationMs: 0,
        searchDurationMs: 0,
        candidateCount: 0,
        returnedChunkCount: 0,
        returnedDocumentCount: 0,
        estimatedContextTokens: 0,
        contextCharacters: 0,
        provider: "",
        model: "",
        dimensions: 0,
        truncated: false
      },
      knowledgeMissing: true,
      suggestHandoff: false,
      allowAnswerWithoutKnowledge: true
    });
    const r = await RetrieveKnowledgeForAgentService({
      companyId: 1,
      aiAgentId: 1,
      query: "x",
      channel: "live"
    });
    expect(r.skippedReason).toBe("disabled");
  });
});
