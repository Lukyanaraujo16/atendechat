import { Request, Response } from "express";
import AppError from "../errors/AppError";
import GetAiAgentAnalyticsService from "../services/AiAgentService/analytics/GetAiAgentAnalyticsService";
import GetAiKnowledgeBaseAnalyticsService from "../services/AiAgentService/analytics/GetAiKnowledgeBaseAnalyticsService";
import GetAiKnowledgeDocumentAnalyticsService from "../services/AiAgentService/analytics/GetAiKnowledgeDocumentAnalyticsService";
import ListAiKnowledgeGapsService from "../services/AiAgentService/analytics/ListAiKnowledgeGapsService";
import UpdateAiKnowledgeGapService from "../services/AiAgentService/analytics/UpdateAiKnowledgeGapService";
import ListAiKnowledgeSuggestionsService from "../services/AiAgentService/analytics/ListAiKnowledgeSuggestionsService";
import UpdateAiKnowledgeSuggestionService from "../services/AiAgentService/analytics/UpdateAiKnowledgeSuggestionService";
import CreateAiKnowledgeSuggestionService from "../services/AiAgentService/analytics/CreateAiKnowledgeSuggestionService";
import {
  listAiAgentExecutionReplays,
  showAiAgentExecutionReplay
} from "../services/AiAgentService/analytics/GetAiAgentExecutionReplayService";
import CompareAiAgentPromptDiffService from "../services/AiAgentService/analytics/CompareAiAgentPromptDiffService";
import GetAiAgentHealthService from "../services/AiAgentService/analytics/GetAiAgentHealthService";
import GetAiAgentObservabilityDashboardService from "../services/AiAgentService/analytics/GetAiAgentObservabilityDashboardService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function userIdOrThrow(req: Request): number {
  const id = Number(req.user?.id);
  if (!Number.isFinite(id)) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function parseOptionalId(raw: unknown): number | undefined {
  if (raw == null || String(raw).trim() === "") return undefined;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return Math.floor(id);
}

function parseIdParam(raw: string): number {
  const id = parseOptionalId(raw);
  if (id == null) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return id;
}

export const dashboard = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await GetAiAgentObservabilityDashboardService({
    companyId,
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined
  });
  return res.json(result);
};

export const agentAnalytics = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await GetAiAgentAnalyticsService({
    companyId,
    aiAgentId: parseOptionalId(req.query.aiAgentId),
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined
  });
  return res.json(result);
};

export const knowledgeBaseAnalytics = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await GetAiKnowledgeBaseAnalyticsService({
    companyId,
    knowledgeBaseId: parseOptionalId(req.query.knowledgeBaseId)
  });
  return res.json(result);
};

export const documentAnalytics = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await GetAiKnowledgeDocumentAnalyticsService({
    companyId,
    knowledgeBaseId: parseOptionalId(req.query.knowledgeBaseId),
    documentId: parseOptionalId(req.query.documentId),
    pageNumber: req.query.pageNumber as string | number | undefined
  });
  return res.json(result);
};

export const health = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId =
    parseOptionalId(req.query.aiAgentId) ?? parseOptionalId(req.params.id);
  if (aiAgentId == null) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "aiAgentId é obrigatório."
    );
  }
  const result = await GetAiAgentHealthService({
    companyId,
    aiAgentId,
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined
  });
  return res.json(result);
};

export const healthScore = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId =
    parseOptionalId(req.query.aiAgentId) ?? parseOptionalId(req.params.id);
  if (aiAgentId == null) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "aiAgentId é obrigatório."
    );
  }
  const result = await GetAiAgentHealthService({
    companyId,
    aiAgentId,
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined
  });
  return res.json({
    healthScore: result.health?.score ?? null,
    formula: result.health?.formula ?? null,
    components: result.health?.components ?? null,
    weights: result.health?.weights ?? null,
    checks: result.checks
  });
};

export const listGaps = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListAiKnowledgeGapsService({
    companyId,
    aiAgentId: parseOptionalId(req.query.aiAgentId),
    resolved:
      req.query.resolved == null || String(req.query.resolved) === ""
        ? undefined
        : String(req.query.resolved) === "true",
    sort: req.query.sort ? String(req.query.sort) : undefined,
    pageNumber: req.query.pageNumber as string | number | undefined
  });
  return res.json(result);
};

export const updateGap = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const gap = await UpdateAiKnowledgeGapService({
    companyId,
    id,
    action: req.body?.action,
    documentId: req.body?.documentId,
    resolvedBy: userIdOrThrow(req)
  });
  return res.json({ gap });
};

export const listSuggestions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListAiKnowledgeSuggestionsService({
    companyId,
    aiAgentId: parseOptionalId(req.query.aiAgentId),
    status: req.query.status ? String(req.query.status) : undefined,
    origin: req.query.origin ? String(req.query.origin) : undefined,
    pageNumber: req.query.pageNumber as string | number | undefined
  });
  return res.json(result);
};

export const createSuggestion = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const suggestion = await CreateAiKnowledgeSuggestionService({
    companyId,
    aiAgentId: req.body?.aiAgentId,
    ticketId: req.body?.ticketId,
    origin: req.body?.origin || "manual",
    questionPreview: req.body?.questionPreview,
    aiReplyPreview: req.body?.aiReplyPreview,
    humanReplyPreview: req.body?.humanReplyPreview,
    differenceSummary: req.body?.differenceSummary,
    reason: req.body?.reason,
    metadata: req.body?.metadata
  });
  return res.status(201).json({ suggestion });
};

export const updateSuggestion = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const suggestion = await UpdateAiKnowledgeSuggestionService({
    companyId,
    id,
    status: req.body?.status,
    reviewedBy: userIdOrThrow(req)
  });
  return res.json({ suggestion });
};

export const listReplays = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await listAiAgentExecutionReplays({
    companyId,
    aiAgentId: parseOptionalId(req.query.aiAgentId),
    channel: req.query.channel ? String(req.query.channel) : undefined,
    pageNumber: req.query.pageNumber as string | number | undefined
  });
  return res.json(result);
};

export const showReplay = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const replay = await showAiAgentExecutionReplay({ companyId, id });
  return res.json({ replay });
};

export const promptDiff = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const leftId = parseOptionalId(req.query.leftId ?? req.body?.leftId);
  const rightId = parseOptionalId(req.query.rightId ?? req.body?.rightId);
  if (leftId == null || rightId == null) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "leftId e rightId são obrigatórios."
    );
  }
  const result = await CompareAiAgentPromptDiffService({
    companyId,
    replayIdA: leftId,
    replayIdB: rightId
  });
  return res.json(result);
};
