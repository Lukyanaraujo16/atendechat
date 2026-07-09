jest.mock("../../../models/AiAgentRuntimeLog", () => ({
  __esModule: true,
  default: { findAndCountAll: jest.fn(), findAll: jest.fn(), findOne: jest.fn() }
}));

jest.mock("../../../models/AiAgentSuggestionReview", () => ({
  __esModule: true,
  default: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() }
}));

jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {}
}));

import AiAgentRuntimeLog from "../../../models/AiAgentRuntimeLog";
import AiAgentSuggestionReview from "../../../models/AiAgentSuggestionReview";
import ListAiAgentShadowSuggestionsService from "../ListAiAgentShadowSuggestionsService";
import GetAiAgentShadowSuggestionsSummaryService from "../GetAiAgentShadowSuggestionsSummaryService";
import UpsertAiAgentSuggestionReviewService from "../UpsertAiAgentSuggestionReviewService";
import { serializeShadowSuggestionRow } from "../serializeShadowSuggestion";

describe("Shadow suggestions observability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseLog = {
    id: 10,
    companyId: 1,
    ticketId: 99,
    contactId: 5,
    aiAgentId: 3,
    eligible: true,
    reason: "eligible",
    mode: "shadow",
    shadowStatus: "failed",
    suggestedReply: "Aguarde um momento.",
    suggestionSource: "fallback",
    shadowModel: "gpt-4o-mini",
    shadowProvider: "openai",
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    latencyMs: 1200,
    errorCode: "provider_unavailable",
    generatedAt: null,
    contextMessageCount: 4,
    createdAt: new Date("2026-07-09T10:00:00Z"),
    metadata: {
      messageType: "text",
      hasText: true,
      hasMedia: false,
      credentialSource: "legacy_prompt",
      credentialId: null,
      evaluatorVersion: "1.2.1"
    },
    aiAgent: { id: 3, name: "Agente Teste" },
    ticket: { id: 99, uuid: "ticket-uuid-99" }
  };

  it("serializa fallback com errorCode visível", () => {
    const row = serializeShadowSuggestionRow({
      log: baseLog as never,
      aiAgent: baseLog.aiAgent as never,
      ticket: baseLog.ticket as never,
      review: null
    });

    expect(row.errorCode).toBe("provider_unavailable");
    expect(row.suggestionSource).toBe("fallback");
    expect(row.credentialSource).toBe("legacy_prompt");
    expect(row.deliveryStatus).toBe("not_sent");
    expect(row.ticketUuid).toBe("ticket-uuid-99");
    expect((row as { metadata?: unknown }).metadata).toBeUndefined();
  });

  it("lista com filtro provider openai", async () => {
    (AiAgentRuntimeLog.findAndCountAll as jest.Mock).mockResolvedValue({
      count: 1,
      rows: [baseLog]
    });
    (AiAgentSuggestionReview.findAll as jest.Mock).mockResolvedValue([]);

    await ListAiAgentShadowSuggestionsService({
      companyId: 1,
      shadowProvider: "openai"
    });

    expect(AiAgentRuntimeLog.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 1,
          shadowProvider: "openai"
        })
      })
    );
  });

  it("lista com filtro provider gemini", async () => {
    (AiAgentRuntimeLog.findAndCountAll as jest.Mock).mockResolvedValue({
      count: 0,
      rows: []
    });
    (AiAgentSuggestionReview.findAll as jest.Mock).mockResolvedValue([]);

    await ListAiAgentShadowSuggestionsService({
      companyId: 1,
      shadowProvider: "gemini"
    });

    expect(AiAgentRuntimeLog.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ shadowProvider: "gemini" })
      })
    );
  });

  it("summary respeita companyId", async () => {
    (AiAgentRuntimeLog.findAll as jest.Mock).mockResolvedValue([
      {
        id: 10,
        shadowStatus: "generated",
        shadowProvider: "gemini",
        totalTokens: 30,
        latencyMs: 400
      }
    ]);
    (AiAgentSuggestionReview.findAll as jest.Mock).mockResolvedValue([]);

    const summary = await GetAiAgentShadowSuggestionsSummaryService({
      companyId: 7
    });

    expect(AiAgentRuntimeLog.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 7 })
      })
    );
    expect(summary.generated).toBe(1);
    expect(summary.providers.gemini).toBe(1);
  });

  it("review cria avaliação", async () => {
    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      companyId: 1,
      aiAgentId: 3,
      ticketId: 99
    });
    (AiAgentSuggestionReview.findOne as jest.Mock).mockResolvedValue(null);
    (AiAgentSuggestionReview.create as jest.Mock).mockResolvedValue({
      id: 1,
      rating: "bad",
      tags: ["invented_information"],
      note: "Inventou preço",
      reviewedBy: 8,
      updatedAt: new Date()
    });

    const review = await UpsertAiAgentSuggestionReviewService({
      companyId: 1,
      runtimeLogId: 10,
      reviewedBy: 8,
      body: {
        rating: "bad",
        tags: ["invented_information"],
        note: "Inventou preço"
      }
    });

    expect(review.rating).toBe("bad");
    expect(review.tags).toContain("invented_information");
  });

  it("review não permite log de outra empresa", async () => {
    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue(null);

    await expect(
      UpsertAiAgentSuggestionReviewService({
        companyId: 2,
        runtimeLogId: 10,
        reviewedBy: 8,
        body: { rating: "good", tags: [] }
      })
    ).rejects.toMatchObject({ message: "ERR_NOT_FOUND" });
  });

  it("review valida rating", async () => {
    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      companyId: 1
    });

    await expect(
      UpsertAiAgentSuggestionReviewService({
        companyId: 1,
        runtimeLogId: 10,
        reviewedBy: 8,
        body: { rating: "invalid", tags: [] }
      })
    ).rejects.toMatchObject({ message: "ERR_VALIDATION_ERROR" });
  });

  it("review limita note", async () => {
    (AiAgentRuntimeLog.findOne as jest.Mock).mockResolvedValue({
      id: 10,
      companyId: 1
    });

    await expect(
      UpsertAiAgentSuggestionReviewService({
        companyId: 1,
        runtimeLogId: 10,
        reviewedBy: 8,
        body: { rating: "good", tags: [], note: "x".repeat(600) }
      })
    ).rejects.toMatchObject({ message: "ERR_VALIDATION_ERROR" });
  });
});
