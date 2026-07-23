import { Request, Response } from "express";
import AppError from "../errors/AppError";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function userIdOrNull(req: Request): number | null {
  const id = req.user?.id;
  if (id == null) return null;
  return typeof id === "number" ? id : Number(id);
}

export const create = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { CreateMemoryService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(
    await CreateMemoryService({
      companyId,
      object: req.body?.object || req.body,
      feedback: req.body?.feedback,
      agentId: req.body?.agentId,
      ticketId: req.body?.ticketId,
      contactId: req.body?.contactId,
      goalId: req.body?.goalId,
      executionId: req.body?.executionId
    })
  );
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ListMemoryService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  return res.json(await ListMemoryService({ companyId, limit }));
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetMemoryService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(
    await GetMemoryService({ companyId, id: String(req.params.id) })
  );
};

export const query = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { QueryMemoryService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(
    await QueryMemoryService({
      companyId,
      query: req.body?.query || req.body || {}
    })
  );
};

export const metrics = async (_req: Request, res: Response): Promise<Response> => {
  const { GetCognitiveMemoryMetricsService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(await GetCognitiveMemoryMetricsService());
};

export const dashboard = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetCognitiveMemoryDashboardService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(await GetCognitiveMemoryDashboardService({ companyId }));
};

export const getConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetCognitiveMemoryConfigService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(await GetCognitiveMemoryConfigService({ companyId }));
};

export const putConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { UpsertCognitiveMemoryConfigService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(
    await UpsertCognitiveMemoryConfigService({
      companyId,
      config: req.body?.config || req.body || {}
    })
  );
};

export const buildKnowledge = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { BuildKnowledgeTesterService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(
    await BuildKnowledgeTesterService({
      companyId,
      feedback: req.body?.feedback,
      runtimeStatus: req.body?.runtimeStatus
    })
  );
};

export const replay = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ReplayCognitiveMemoryService } = await import(
    "../services/AutomationOrchestrator/cognitive/memory/CognitiveMemoryAdminServices"
  );
  return res.json(
    await ReplayCognitiveMemoryService({
      companyId,
      userId: userIdOrNull(req),
      text: req.body?.text,
      sessionId: req.body?.sessionId
    })
  );
};
