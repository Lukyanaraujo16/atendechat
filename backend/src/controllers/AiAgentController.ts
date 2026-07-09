import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListAiAgentsService from "../services/AiAgentService/ListAiAgentsService";
import ShowAiAgentService from "../services/AiAgentService/ShowAiAgentService";
import CreateAiAgentService from "../services/AiAgentService/CreateAiAgentService";
import UpdateAiAgentService from "../services/AiAgentService/UpdateAiAgentService";
import DeleteAiAgentService from "../services/AiAgentService/DeleteAiAgentService";
import ListAiAgentShadowSuggestionsService from "../services/AiAgentService/ListAiAgentShadowSuggestionsService";
import GetAiAgentShadowSuggestionsSummaryService from "../services/AiAgentService/GetAiAgentShadowSuggestionsSummaryService";
import UpsertAiAgentSuggestionReviewService from "../services/AiAgentService/UpsertAiAgentSuggestionReviewService";
import {
  parseOptionalBoolean,
  parseOptionalPositiveInt,
  ShadowSuggestionListFilters
} from "../services/AiAgentService/shadowSuggestionFilters";

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
    dateTo: query.dateTo as string | undefined
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
