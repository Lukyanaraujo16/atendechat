import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListAiAgentsService from "../services/AiAgentService/ListAiAgentsService";
import ShowAiAgentService from "../services/AiAgentService/ShowAiAgentService";
import CreateAiAgentService from "../services/AiAgentService/CreateAiAgentService";
import UpdateAiAgentService from "../services/AiAgentService/UpdateAiAgentService";
import DeleteAiAgentService from "../services/AiAgentService/DeleteAiAgentService";
import ListAiAgentShadowSuggestionsService from "../services/AiAgentService/ListAiAgentShadowSuggestionsService";
import GetAiAgentShadowSuggestionsSummaryService from "../services/AiAgentService/GetAiAgentShadowSuggestionsSummaryService";
import ShowAiAgentProfileService from "../services/AiAgentService/ShowAiAgentProfileService";
import UpsertAiAgentProfileService from "../services/AiAgentService/UpsertAiAgentProfileService";
import GenerateAiAgentPromptPreviewService from "../services/AiAgentService/GenerateAiAgentPromptPreviewService";
import UpsertAiAgentSuggestionReviewService from "../services/AiAgentService/UpsertAiAgentSuggestionReviewService";
import UpsertAiAgentSimulationMessageReviewService from "../services/AiAgentService/UpsertAiAgentSimulationMessageReviewService";
import {
  checkAiAgentSimulatorCredential,
  createAiAgentSimulationSession,
  endAiAgentSimulationSession,
  listAiAgentSimulationSessions,
  sendAiAgentSimulationMessage,
  showAiAgentSimulationSession
} from "../services/AiAgentService/AiAgentSimulationService";
import {
  parseOptionalBoolean,
  parseOptionalPositiveInt,
  ShadowSuggestionListFilters
} from "../services/AiAgentService/shadowSuggestionFilters";
import ListAiAgentKnowledgeBasesService from "../services/AiAgentService/knowledge/ListAiAgentKnowledgeBasesService";
import SyncAiAgentKnowledgeBasesService from "../services/AiAgentService/knowledge/SyncAiAgentKnowledgeBasesService";
import ShowAiAgentKnowledgeSettingsService, {
  serializeAiAgentKnowledgeSettings
} from "../services/AiAgentService/knowledge/ShowAiAgentKnowledgeSettingsService";
import UpsertAiAgentKnowledgeSettingsService from "../services/AiAgentService/knowledge/UpsertAiAgentKnowledgeSettingsService";
import RetrieveKnowledgeForAgentService from "../services/AiAgentService/knowledge/RetrieveKnowledgeForAgentService";
import ListKnowledgeRetrievalsService, {
  ShowKnowledgeRetrievalService
} from "../services/AiAgentService/knowledge/ListKnowledgeRetrievalsService";

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

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return id;
}

function parseShadowFilters(req: Request, companyId: number): ShadowSuggestionListFilters {
  const query = req.query;
  return {
    companyId,
    pageNumber: query.pageNumber as string | undefined,
    aiAgentId: parseOptionalPositiveInt(query.aiAgentId, "aiAgentId"),
    shadowStatus: query.shadowStatus as string | undefined,
    shadowProvider: query.shadowProvider as string | undefined,
    shadowModel: query.shadowModel as string | undefined,
    eligible: parseOptionalBoolean(query.eligible),
    errorCode: query.errorCode as string | undefined,
    suggestionSource: query.suggestionSource as string | undefined,
    ticketId: parseOptionalPositiveInt(query.ticketId, "ticketId"),
    dateFrom: query.dateFrom as string | undefined,
    dateTo: query.dateTo as string | undefined,
    knowledgeUsage: query.knowledgeUsage as string | undefined
  };
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const agents = await ListAiAgentsService({ companyId });
  return res.json(agents);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const agent = await ShowAiAgentService({ companyId, id });
  return res.json(agent);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const agent = await CreateAiAgentService({ companyId, body: req.body });
  return res.status(201).json(agent);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const agent = await UpdateAiAgentService({
    companyId,
    id,
    body: req.body
  });
  return res.json(agent);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const result = await DeleteAiAgentService({ companyId, id });
  return res.json(result);
};

export const shadowSuggestions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListAiAgentShadowSuggestionsService(
    parseShadowFilters(req, companyId)
  );
  return res.json(result);
};

export const shadowSuggestionsSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const summary = await GetAiAgentShadowSuggestionsSummaryService(
    parseShadowFilters(req, companyId)
  );
  return res.json(summary);
};

export const upsertShadowSuggestionReview = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const runtimeLogId = parseIdParam(req.params.id);
  const review = await UpsertAiAgentSuggestionReviewService({
    companyId,
    runtimeLogId,
    reviewedBy: userIdOrThrow(req),
    body: req.body
  });
  return res.json(review);
};

export const showProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const profile = await ShowAiAgentProfileService({ companyId, aiAgentId });
  return res.json({ profile });
};

export const upsertProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const profile = await UpsertAiAgentProfileService({
    companyId,
    aiAgentId,
    body: req.body
  });
  return res.json({ profile });
};

export const previewProfilePrompt = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const preview = await GenerateAiAgentPromptPreviewService({
    companyId,
    aiAgentId,
    body: req.body
  });
  return res.json(preview);
};

export const simulatorCredentialCheck = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const result = await checkAiAgentSimulatorCredential({ companyId, aiAgentId });
  return res.json(result);
};

export const createSimulatorSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const session = await createAiAgentSimulationSession({
    companyId,
    aiAgentId,
    createdBy: userIdOrThrow(req)
  });
  return res.status(201).json(session);
};

export const listSimulatorSessions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const result = await listAiAgentSimulationSessions({
    companyId,
    aiAgentId,
    pageNumber: req.query.pageNumber as string | undefined
  });
  return res.json(result);
};

export const showSimulatorSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const sessionId = parseIdParam(req.params.sessionId);
  const session = await showAiAgentSimulationSession({
    companyId,
    aiAgentId,
    sessionId
  });
  return res.json(session);
};

export const sendSimulatorMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const sessionId = parseIdParam(req.params.sessionId);
  const result = await sendAiAgentSimulationMessage({
    companyId,
    aiAgentId,
    sessionId,
    content: req.body?.content
  });
  return res.json(result);
};

export const endSimulatorSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const sessionId = parseIdParam(req.params.sessionId);
  const result = await endAiAgentSimulationSession({
    companyId,
    aiAgentId,
    sessionId
  });
  return res.json(result);
};

export const upsertSimulatorMessageReview = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const sessionId = parseIdParam(req.params.sessionId);
  const messageId = parseIdParam(req.params.messageId);
  const review = await UpsertAiAgentSimulationMessageReviewService({
    companyId,
    aiAgentId,
    sessionId,
    messageId,
    reviewedBy: userIdOrThrow(req),
    body: req.body
  });
  return res.json(review);
};

export const listKnowledgeBases = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const result = await ListAiAgentKnowledgeBasesService({
    companyId,
    aiAgentId
  });
  return res.json(result);
};

export const syncKnowledgeBases = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const result = await SyncAiAgentKnowledgeBasesService({
    companyId,
    aiAgentId,
    userId: userIdOrThrow(req),
    links: Array.isArray(req.body?.links) ? req.body.links : []
  });
  return res.json(result);
};

export const showKnowledgeSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const row = await ShowAiAgentKnowledgeSettingsService({
    companyId,
    aiAgentId,
    userId: userIdOrThrow(req)
  });
  return res.json({ settings: serializeAiAgentKnowledgeSettings(row) });
};

export const upsertKnowledgeSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const settings = await UpsertAiAgentKnowledgeSettingsService({
    companyId,
    aiAgentId,
    userId: userIdOrThrow(req),
    body: req.body || {}
  });
  return res.json({ settings });
};

export const testKnowledgeRetrieval = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const query = String(req.body?.query || "").trim();
  const result = await RetrieveKnowledgeForAgentService({
    companyId,
    aiAgentId,
    query,
    channel: "test",
    forceEnabled: true,
    topK: req.body?.topK != null ? Number(req.body.topK) : undefined,
    minimumScore:
      req.body?.minimumScore != null
        ? Number(req.body.minimumScore)
        : undefined,
    documentTypes: Array.isArray(req.body?.documentTypes)
      ? req.body.documentTypes.map(String)
      : undefined,
    language: req.body?.language ? String(req.body.language) : null,
    requestId: `test-${aiAgentId}-${Date.now()}`
  });
  return res.json({
    enabled: result.enabled,
    performed: result.performed,
    skippedReason: result.skippedReason,
    status: result.status,
    queryUsed: result.queryUsed,
    results: result.results.map(r => ({
      knowledgeBaseId: r.knowledgeBaseId,
      knowledgeBaseName: r.knowledgeBaseName,
      documentId: r.documentId,
      documentTitle: r.documentTitle,
      documentType: r.documentType,
      chunkId: r.chunkId,
      sectionTitle: r.sectionTitle,
      content: r.content,
      similarityScore: r.similarityScore,
      sourceType: r.sourceType,
      sourceUrl: r.sourceUrl,
      language: r.language,
      priority: r.priority
    })),
    contextText: result.contextText,
    sources: result.sources,
    metrics: result.metrics,
    errorCode: result.errorCode || null,
    errorMessage: result.errorMessage || null,
    knowledgeMissing: result.knowledgeMissing,
    retrievalId: result.retrievalId || null
  });
};

export const listKnowledgeRetrievals = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const result = await ListKnowledgeRetrievalsService({
    companyId,
    aiAgentId,
    channel: req.query.channel as string | undefined,
    status: req.query.status as string | undefined,
    pageNumber: req.query.pageNumber as string | undefined
  });
  return res.json(result);
};

export const showKnowledgeRetrieval = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const aiAgentId = parseIdParam(req.params.id);
  const retrievalId = parseIdParam(req.params.retrievalId);
  const retrieval = await ShowKnowledgeRetrievalService({
    companyId,
    aiAgentId,
    retrievalId
  });
  return res.json({ retrieval });
};
