import { Op } from "sequelize";
import AiAgent from "../../../models/AiAgent";
import AiAgentKnowledgeBase from "../../../models/AiAgentKnowledgeBase";
import AiAgentKnowledgeSettings from "../../../models/AiAgentKnowledgeSettings";
import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentStats from "../../../models/AiKnowledgeDocumentStats";
import GetAiAgentAnalyticsService from "./GetAiAgentAnalyticsService";
import computeAiAgentHealthScore from "./ComputeAiAgentHealthScoreService";

export type HealthCheck = {
  code: string;
  severity: "info" | "warn" | "critical";
  message: string;
  meta?: Record<string, unknown>;
};

export default async function GetAiAgentHealthService(input: {
  companyId: number;
  aiAgentId: number;
  dateFrom?: string | Date | null;
  dateTo?: string | Date | null;
}) {
  const agent = await AiAgent.findOne({
    where: { id: input.aiAgentId, companyId: input.companyId }
  });

  const analytics = await GetAiAgentAnalyticsService({
    companyId: input.companyId,
    aiAgentId: input.aiAgentId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo
  });

  const bindings = await AiAgentKnowledgeBase.findAll({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      enabled: true
    }
  });

  const baseIds = bindings.map(b => b.knowledgeBaseId);
  let documents: AiKnowledgeDocument[] = [];
  if (baseIds.length > 0) {
    documents = await AiKnowledgeDocument.findAll({
      where: {
        companyId: input.companyId,
        knowledgeBaseId: { [Op.in]: baseIds }
      },
      attributes: ["id", "knowledgeBaseId", "indexStatus", "title"]
    });
  }

  const indexedDocs = documents.filter(d => d.indexStatus === "completed");
  const hasIndexedDocuments = indexedDocs.length > 0;

  const settings = await AiAgentKnowledgeSettings.findOne({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId
    }
  });

  const checks: HealthCheck[] = [];

  if (baseIds.length === 0) {
    checks.push({
      code: "base_without_docs",
      severity: "warn",
      message: "Agente sem bases de conhecimento vinculadas."
    });
  } else if (documents.length === 0) {
    checks.push({
      code: "base_without_docs",
      severity: "warn",
      message: "Bases vinculadas sem documentos cadastrados.",
      meta: { knowledgeBaseIds: baseIds }
    });
  }

  if (baseIds.length > 0 && documents.length > 0 && !hasIndexedDocuments) {
    checks.push({
      code: "base_not_indexed",
      severity: "critical",
      message: "Nenhum documento indexado nas bases vinculadas.",
      meta: { documentCount: documents.length }
    });
  }

  const stats =
    documents.length > 0
      ? await AiKnowledgeDocumentStats.findAll({
          where: {
            companyId: input.companyId,
            documentId: { [Op.in]: documents.map(d => d.id) }
          }
        })
      : [];
  const usedIds = new Set(
    stats.filter(s => Number(s.retrievalCount || 0) > 0).map(s => s.documentId)
  );
  const unusedCount = documents.filter(d => !usedIds.has(d.id)).length;
  if (documents.length > 0 && unusedCount / documents.length >= 0.5) {
    checks.push({
      code: "unused_documents",
      severity: "info",
      message: "Muitos documentos nunca utilizados em retrieval.",
      meta: { unusedCount, documentCount: documents.length }
    });
  }

  const retrievals = analytics.totals.knowledgeRetrievals;
  const misses = analytics.totals.knowledgeMisses;
  if (retrievals >= 10 && misses === retrievals) {
    checks.push({
      code: "retrieval_always_empty",
      severity: "critical",
      message: "Retrievals no período sempre vazios/miss.",
      meta: { retrievals, misses }
    });
  }

  const handoffRate = analytics.averages.handoffRate ?? 0;
  if (handoffRate >= 0.4 && analytics.totals.totalInteractions >= 10) {
    checks.push({
      code: "handoff_high",
      severity: "warn",
      message: "Taxa de handoff elevada no período.",
      meta: { handoffRate }
    });
  }

  const health = computeAiAgentHealthScore({
    missRate: analytics.averages.missRate ?? 0,
    handoffRate,
    failureRate: analytics.averages.failureRate ?? 0,
    avgRetrievalMs: analytics.averages.avgRetrievalTimeMs,
    hasIndexedDocuments
  });

  if (health.score < 50) {
    checks.push({
      code: "score_low",
      severity: "warn",
      message: "Health score abaixo de 50.",
      meta: { score: health.score }
    });
  }

  if (
    settings &&
    settings.allowAnswerWithoutKnowledge &&
    settings.handoffWhenKnowledgeMissing
  ) {
    checks.push({
      code: "inconsistent_config",
      severity: "info",
      message:
        "allowAnswerWithoutKnowledge e handoffWhenKnowledgeMissing ambos true — handoff tem precedência quando falta conhecimento.",
      meta: {
        allowAnswerWithoutKnowledge: true,
        handoffWhenKnowledgeMissing: true,
        precedence: "handoff"
      }
    });
  }

  return {
    aiAgentId: input.aiAgentId,
    agentName: agent?.name ?? null,
    health,
    checks,
    analytics: {
      totals: analytics.totals,
      averages: analytics.averages
    },
    coverage: {
      linkedBases: baseIds.length,
      documents: documents.length,
      indexedDocuments: indexedDocs.length,
      unusedDocuments: unusedCount
    }
  };
}
