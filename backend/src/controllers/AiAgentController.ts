import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListAiAgentsService from "../services/AiAgentService/ListAiAgentsService";
import ShowAiAgentService from "../services/AiAgentService/ShowAiAgentService";
import CreateAiAgentService from "../services/AiAgentService/CreateAiAgentService";
import UpdateAiAgentService from "../services/AiAgentService/UpdateAiAgentService";
import DeleteAiAgentService from "../services/AiAgentService/DeleteAiAgentService";
import ListAiAgentShadowSuggestionsService from "../services/AiAgentService/ListAiAgentShadowSuggestionsService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return id;
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
  const { pageNumber, aiAgentId, shadowStatus, eligible } = req.query;

  let parsedAgentId: number | undefined;
  if (aiAgentId != null && String(aiAgentId).trim() !== "") {
    parsedAgentId = Number(aiAgentId);
    if (!Number.isFinite(parsedAgentId)) {
      throw new AppError("ERR_VALIDATION_ERROR", 400, "aiAgentId inválido.");
    }
  }

  let parsedEligible: boolean | undefined;
  if (eligible === "true") parsedEligible = true;
  if (eligible === "false") parsedEligible = false;

  const result = await ListAiAgentShadowSuggestionsService({
    companyId,
    pageNumber: pageNumber as string | undefined,
    aiAgentId: parsedAgentId,
    shadowStatus: shadowStatus as string | undefined,
    eligible: parsedEligible
  });

  return res.json(result);
};
