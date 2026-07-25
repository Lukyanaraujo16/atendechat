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

export const process = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ProcessExecutionFeedbackService } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackAdminServices"
  );
  return res.json(
    await ProcessExecutionFeedbackService({
      companyId,
      session: req.body?.session,
      sessionId: req.body?.sessionId,
      actionId: req.body?.actionId,
      stepId: req.body?.stepId,
      runtimeRequestId: req.body?.runtimeRequestId,
      runtimeResultId: req.body?.runtimeResultId,
      runtimeResult: req.body?.runtimeResult,
      actionResult: req.body?.actionResult,
      entities: req.body?.entities,
      constraints: req.body?.constraints,
      stepRetryable: req.body?.stepRetryable,
      stepOptional: req.body?.stepOptional,
      requiresConfirmation: req.body?.requiresConfirmation,
      text: req.body?.text
    })
  );
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ListExecutionFeedbackService } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackAdminServices"
  );
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const out = await ListExecutionFeedbackService({ companyId, limit });
  const { filterRecordsOwnedByCompany } = await import(
    "../helpers/agentOsTenantOwnership"
  );
  return res.json({
    ...out,
    feedbacks: filterRecordsOwnedByCompany(out?.feedbacks, companyId)
  });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetExecutionFeedbackService } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackAdminServices"
  );
  const out = await GetExecutionFeedbackService({
    companyId,
    id: String(req.params.id)
  });
  const { assertRecordOwnedByCompany } = await import(
    "../helpers/agentOsTenantOwnership"
  );
  assertRecordOwnedByCompany(out?.feedback, companyId);
  return res.json(out);
};

export const metrics = async (_req: Request, res: Response): Promise<Response> => {
  const { getExecutionFeedbackMetrics } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackMetrics"
  );
  return res.json({
    metrics: getExecutionFeedbackMetrics(),
    executesTools: false,
    callsPlanner: false
  });
};

export const dashboard = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetExecutionFeedbackDashboardService } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackAdminServices"
  );
  return res.json(await GetExecutionFeedbackDashboardService({ companyId }));
};

export const getConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetExecutionFeedbackConfigService } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackAdminServices"
  );
  return res.json(await GetExecutionFeedbackConfigService({ companyId }));
};

export const putConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { UpsertExecutionFeedbackConfigService } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackAdminServices"
  );
  return res.json(
    await UpsertExecutionFeedbackConfigService({
      companyId,
      config: req.body?.config || req.body || {}
    })
  );
};

export const simulate = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { SimulateFeedbackService } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackAdminServices"
  );
  return res.json(
    await SimulateFeedbackService({
      companyId,
      runtimeStatus: req.body?.runtimeStatus,
      actionStatus: req.body?.actionStatus,
      validation: req.body?.validation,
      requiresConfirmation: req.body?.requiresConfirmation,
      stepRetryable: req.body?.stepRetryable,
      stepOptional: req.body?.stepOptional,
      objective: req.body?.objective
    })
  );
};

export const replay = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ReplayExecutionFeedbackService } = await import(
    "../services/AutomationOrchestrator/cognitive/feedback/ExecutionFeedbackAdminServices"
  );
  return res.json(
    await ReplayExecutionFeedbackService({
      companyId,
      userId: userIdOrNull(req),
      text: req.body?.text,
      sessionId: req.body?.sessionId
    })
  );
};
