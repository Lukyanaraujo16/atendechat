jest.mock("../../../../models/AiKnowledgeGap", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../../models/AiKnowledgeSuggestion", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn()
  }
}));

jest.mock("../../../../models/AiKnowledgeDocument", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn()
  }
}));

jest.mock("../../../../utils/logger", () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() }
}));

import AiKnowledgeGap from "../../../../models/AiKnowledgeGap";
import AiKnowledgeSuggestion from "../../../../models/AiKnowledgeSuggestion";
import AiKnowledgeDocument from "../../../../models/AiKnowledgeDocument";
import AppError from "../../../../errors/AppError";
import { AI_AGENT_HEALTH_SCORE_WEIGHTS } from "../../../../config/aiAgentAnalyticsConstants";
import {
  hashQuestion,
  sanitizeReplaySnapshot
} from "../analyticsHelpers";
import { safeRecordKnowledgeGap } from "../recordKnowledgeGap";
import { lineDiff } from "../CompareAiAgentPromptDiffService";
import computeAiAgentHealthScore from "../ComputeAiAgentHealthScoreService";
import UpdateAiKnowledgeGapService from "../UpdateAiKnowledgeGapService";

describe("analyticsObservability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("gap upsert", () => {
    it("incrementa frequency quando gap já existe", async () => {
      const existing = {
        id: 7,
        companyId: 1,
        aiAgentId: 2,
        frequency: 3,
        questionPreview: "como funciona?",
        questionHash: hashQuestion("como funciona?"),
        knowledgeStatus: "empty",
        channel: "live",
        ticketId: null,
        simulationId: null,
        metadata: null,
        reason: "empty_retrieval",
        update: jest.fn().mockImplementation(async function update(this: {
          frequency: number;
        }, patch: { frequency: number }) {
          this.frequency = patch.frequency;
          return this;
        })
      };

      (AiKnowledgeGap.findOne as jest.Mock).mockResolvedValue(existing);
      (AiKnowledgeSuggestion.findOne as jest.Mock).mockResolvedValue(null);

      const result = await safeRecordKnowledgeGap({
        companyId: 1,
        aiAgentId: 2,
        channel: "live",
        question: "como funciona?",
        knowledgeStatus: "empty",
        reason: "empty_retrieval"
      });

      expect(existing.update).toHaveBeenCalledWith(
        expect.objectContaining({ frequency: 4 })
      );
      expect(result).toBe(existing);
      expect(AiKnowledgeGap.create).not.toHaveBeenCalled();
    });
  });

  describe("health score formula", () => {
    it("mantém score entre 0 e 100", () => {
      const worst = computeAiAgentHealthScore({
        missRate: 1,
        handoffRate: 1,
        failureRate: 1,
        avgRetrievalMs: 999999,
        hasIndexedDocuments: false
      });
      expect(worst.score).toBeGreaterThanOrEqual(0);
      expect(worst.score).toBeLessThanOrEqual(100);

      const best = computeAiAgentHealthScore({
        missRate: 0,
        handoffRate: 0,
        failureRate: 0,
        avgRetrievalMs: 0,
        hasIndexedDocuments: true
      });
      expect(best.score).toBe(100);
      expect(best.formula).toContain("clamp");
      expect(best.weights).toEqual(AI_AGENT_HEALTH_SCORE_WEIGHTS);
    });

    it("aplica cobertura quando não há docs indexados", () => {
      const withCoverage = computeAiAgentHealthScore({
        missRate: 0,
        handoffRate: 0,
        failureRate: 0,
        avgRetrievalMs: 0,
        hasIndexedDocuments: false
      });
      expect(withCoverage.components.coveragePenalty).toBe(
        AI_AGENT_HEALTH_SCORE_WEIGHTS.W_COVERAGE
      );
      expect(withCoverage.score).toBe(
        100 - AI_AGENT_HEALTH_SCORE_WEIGHTS.W_COVERAGE
      );
    });
  });

  describe("prompt diff", () => {
    it("marca linhas same/add/remove", () => {
      const diff = lineDiff("a\nb\nc", "a\nx\nc");
      expect(diff).toEqual([
        { type: "same", text: "a" },
        { type: "remove", text: "b" },
        { type: "add", text: "x" },
        { type: "same", text: "c" }
      ]);
    });
  });

  describe("sanitizeReplaySnapshot", () => {
    it("remove apiKey, embedding e storagePath", () => {
      const sanitized = sanitizeReplaySnapshot({
        prompt: "hello",
        apiKey: "sk-secret",
        embedding: [0.1, 0.2, 0.3],
        embeddings: [[1, 2]],
        storagePath: "/var/secret/file.pdf",
        context: "ctx",
        nested: {
          api_key: "x",
          safe: 1
        }
      });

      expect(sanitized.apiKey).toBeUndefined();
      expect(sanitized.embedding).toBeUndefined();
      expect(sanitized.embeddings).toBeUndefined();
      expect(sanitized.storagePath).toBeUndefined();
      expect(sanitized.prompt).toBe("hello");
      expect(sanitized.context).toBe("ctx");
      expect((sanitized.nested as Record<string, unknown>).api_key).toBeUndefined();
      expect((sanitized.nested as Record<string, unknown>).safe).toBe(1);
    });
  });

  describe("tenant UpdateAiKnowledgeGap", () => {
    it("rejeita documento de outra empresa", async () => {
      (AiKnowledgeGap.findOne as jest.Mock).mockResolvedValue({
        id: 1,
        companyId: 1,
        update: jest.fn()
      });
      (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue(null);

      await expect(
        UpdateAiKnowledgeGapService({
          companyId: 1,
          id: 1,
          action: "resolve",
          documentId: 999
        })
      ).rejects.toBeInstanceOf(AppError);

      await expect(
        UpdateAiKnowledgeGapService({
          companyId: 1,
          id: 1,
          action: "resolve",
          documentId: 999
        })
      ).rejects.toMatchObject({
        message: "ERR_NOT_FOUND",
        statusCode: 404
      });
    });
  });
});
