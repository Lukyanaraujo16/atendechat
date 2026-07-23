import { Request, Response } from "express";
import AppError from "../errors/AppError";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

export const dashboard = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetExecutionSessionsDashboardService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(await GetExecutionSessionsDashboardService({ companyId }));
};

export const metrics = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { getExecutionOrchestratorMetrics } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorMetrics"
  );
  const { getExecutionOrchestratorConfig } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorConfig"
  );
  return res.json({
    metrics: getExecutionOrchestratorMetrics(companyId),
    config: getExecutionOrchestratorConfig(companyId)
  });
};

export const getConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetExecutionOrchestratorConfigService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(await GetExecutionOrchestratorConfigService({ companyId }));
};

export const putConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { UpsertExecutionOrchestratorConfigService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await UpsertExecutionOrchestratorConfigService({
      companyId,
      config: req.body?.config || req.body || {}
    })
  );
};

export const createSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { CreateExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await CreateExecutionSessionService({
      companyId,
      text: req.body?.text || req.body?.message,
      goal: req.body?.goal,
      plan: req.body?.plan,
      evaluation: req.body?.evaluation
    })
  );
};

export const startSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId) throw new AppError("ERR_VALIDATION_ERROR", 400, "sessionId obrigatório.");
  const { StartExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(await StartExecutionSessionService({ companyId, sessionId }));
};

export const pauseSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId) throw new AppError("ERR_VALIDATION_ERROR", 400, "sessionId obrigatório.");
  const { PauseExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(await PauseExecutionSessionService({ companyId, sessionId }));
};

export const resumeSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId) throw new AppError("ERR_VALIDATION_ERROR", 400, "sessionId obrigatório.");
  const { ResumeExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(await ResumeExecutionSessionService({ companyId, sessionId }));
};

export const abortSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId) throw new AppError("ERR_VALIDATION_ERROR", 400, "sessionId obrigatório.");
  const { AbortExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(await AbortExecutionSessionService({ companyId, sessionId }));
};

export const advanceSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId) throw new AppError("ERR_VALIDATION_ERROR", 400, "sessionId obrigatório.");
  const { AdvanceExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await AdvanceExecutionSessionService({
      companyId,
      sessionId,
      action: req.body?.action || "complete",
      stepId: req.body?.stepId
    })
  );
};

export const listSessions = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ListExecutionSessionsService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await ListExecutionSessionsService({
      companyId,
      limit: req.query?.limit ? Number(req.query.limit) : 20
    })
  );
};

export const showSession = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await GetExecutionSessionService({
      companyId,
      id: String(req.params.id)
    })
  );
};

export const replayById = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ReplayExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await ReplayExecutionSessionService({
      companyId,
      sessionId: String(req.params.id)
    })
  );
};

export const replay = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ReplayExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await ReplayExecutionSessionService({
      companyId,
      sessionId: req.body?.sessionId,
      text: req.body?.text
    })
  );
};

export const simulateTransition = async (req: Request, res: Response): Promise<Response> => {
  companyIdOrThrow(req);
  const { SimulateTransitionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await SimulateTransitionService({
      from: String(req.body?.from || ""),
      to: String(req.body?.to || "")
    })
  );
};

export const inspectGraph = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { InspectGraphService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await InspectGraphService({
      companyId,
      text: req.body?.text,
      sessionId: req.body?.sessionId
    })
  );
};

export const simulateRecovery = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { SimulateRecoveryService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(
    await SimulateRecoveryService({
      companyId,
      sessionId: req.body?.sessionId,
      text: req.body?.text,
      stepId: req.body?.stepId
    })
  );
};

export const nextSteps = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sessionId = String(req.body?.sessionId || "");
  if (!sessionId) throw new AppError("ERR_VALIDATION_ERROR", 400, "sessionId obrigatório.");
  const { GetExecutionSessionService } = await import(
    "../services/AutomationOrchestrator/cognitive/execution/ExecutionOrchestratorAdminServices"
  );
  return res.json(await GetExecutionSessionService({ companyId, id: sessionId }));
};
