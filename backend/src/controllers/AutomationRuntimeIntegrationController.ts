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

export const execute = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ExecuteRuntimeIntegrationService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  return res.json(
    await ExecuteRuntimeIntegrationService({
      companyId,
      userId: userIdOrNull(req),
      action: req.body?.action,
      stepId: req.body?.stepId,
      stepType: req.body?.stepType,
      objective: req.body?.objective,
      sessionId: req.body?.sessionId,
      executionId: req.body?.executionId
    })
  );
};

export const requests = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ListRuntimeRequestsService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  return res.json(await ListRuntimeRequestsService({ companyId, limit }));
};

export const requestById = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetRuntimeRequestService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  return res.json(
    await GetRuntimeRequestService({ companyId, id: String(req.params.id) })
  );
};

export const metrics = async (req: Request, res: Response): Promise<Response> => {
  const { getRuntimeIntegrationMetrics } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationMetrics"
  );
  return res.json({
    metrics: getRuntimeIntegrationMetrics(),
    reusedExistingRuntime: true
  });
};

export const policies = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetRuntimePoliciesService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  return res.json(await GetRuntimePoliciesService({ companyId }));
};

export const dashboard = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetRuntimeIntegrationDashboardService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  return res.json(await GetRuntimeIntegrationDashboardService({ companyId }));
};

export const getConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { GetRuntimeIntegrationConfigService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  return res.json(await GetRuntimeIntegrationConfigService({ companyId }));
};

export const putConfig = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { UpsertRuntimeIntegrationConfigService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  return res.json(
    await UpsertRuntimeIntegrationConfigService({
      companyId,
      config: req.body?.config || req.body || {}
    })
  );
};

export const previewRequest = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { BuildRuntimeRequestPreviewService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  if (!req.body?.action) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "action obrigatório.");
  }
  return res.json(
    await BuildRuntimeRequestPreviewService({
      companyId,
      action: req.body.action
    })
  );
};

export const inspectDispatcher = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { InspectRuntimeDispatcherService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  return res.json(
    await InspectRuntimeDispatcherService({
      companyId,
      actionType: req.body?.actionType,
      operation: req.body?.operation
    })
  );
};

export const simulatePolicy = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { SimulateRuntimePolicyService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  if (!req.body?.action) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "action obrigatório.");
  }
  return res.json(
    await SimulateRuntimePolicyService({
      companyId,
      action: req.body.action
    })
  );
};

export const replay = async (req: Request, res: Response): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { ReplayRuntimeIntegrationService } = await import(
    "../services/AutomationOrchestrator/runtimeIntegration/RuntimeIntegrationAdminServices"
  );
  return res.json(
    await ReplayRuntimeIntegrationService({
      companyId,
      userId: userIdOrNull(req),
      text: req.body?.text,
      sessionId: req.body?.sessionId
    })
  );
};
