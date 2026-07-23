import { Request, Response } from "express";
import AppError from "../errors/AppError";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

export const execute = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ExecuteActionService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(
    await ExecuteActionService({
      companyId,
      action: req.body?.action,
      sessionId: req.body?.sessionId,
      stepId: req.body?.stepId,
      stepType: req.body?.stepType,
      objective: req.body?.objective
    })
  );
};

export const strategies = async (req: Request, res: Response): Promise<Response> => {
  const { ListStrategiesService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(await ListStrategiesService());
};

export const results = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ListActionResultsService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  return res.json(await ListActionResultsService({ companyId, limit }));
};

export const resultById = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetActionResultService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(
    await GetActionResultService({ companyId, id: String(req.params.id) })
  );
};

export const dashboard = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetActionExecutionDashboardService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(await GetActionExecutionDashboardService({ companyId }));
};

export const getConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetActionExecutionConfigService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(await GetActionExecutionConfigService({ companyId }));
};

export const putConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { UpsertActionExecutionConfigService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(
    await UpsertActionExecutionConfigService({
      companyId,
      config: req.body?.config || req.body || {}
    })
  );
};

export const replay = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ReplayActionExecutionService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(
    await ReplayActionExecutionService({
      companyId,
      sessionId: req.body?.sessionId,
      text: req.body?.text
    })
  );
};

export const simulate = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { SimulateActionService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(
    await SimulateActionService({
      companyId,
      actionType: req.body?.actionType || "SEARCH",
      objective: req.body?.objective
    })
  );
};

export const inspectStrategy = async (req: Request, res: Response): Promise<Response> => {
  const { InspectStrategyService } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionAdminServices"
  );
  return res.json(
    await InspectStrategyService({
      actionType: String(req.body?.actionType || req.query.actionType || "SEARCH")
    })
  );
};

export const metrics = async (req: Request, res: Response): Promise<Response> => {
  const { getActionExecutionMetrics } = await import(
    "../services/AutomationOrchestrator/cognitive/action/ActionExecutionMetrics"
  );
  return res.json({ metrics: getActionExecutionMetrics(), usesToolRuntime: false });
};
