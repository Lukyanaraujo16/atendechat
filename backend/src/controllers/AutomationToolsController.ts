import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  GetToolCatalogService,
  ListToolExecutionsService,
  GetToolExecutionService,
  TestToolService,
  GetToolPoliciesService,
  UpsertToolPoliciesService,
  GetToolMetricsService
} from "../services/AutomationOrchestrator/tools/ToolAdminServices";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function userIdOrThrow(req: Request): number {
  const id = req.user?.id;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return Number(id);
}

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return Math.floor(id);
}

function parsePage(raw: unknown): { limit: number; offset: number } {
  const page = Math.max(1, Number(raw) || 1);
  const limit = 20;
  return { limit, offset: (page - 1) * limit };
}

export const catalog = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await GetToolCatalogService({ companyId });
  return res.json(result);
};

export const listExecutions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { limit, offset } = parsePage(req.query.pageNumber);
  const result = await ListToolExecutionsService({
    companyId,
    toolId: req.query.toolId ? String(req.query.toolId) : undefined,
    status: req.query.status ? String(req.query.status) : undefined,
    limit,
    offset
  });
  return res.json({
    records: result.rows,
    count: result.count,
    hasMore: result.count > offset + result.rows.length
  });
};

export const showExecution = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const execution = await GetToolExecutionService({ companyId, id });
  return res.json({ execution });
};

export const testTool = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const userId = userIdOrThrow(req);
  const toolId = String(req.params.toolId || "").trim();
  if (!toolId) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "toolId obrigatório.");
  }

  const body = (req.body || {}) as Record<string, unknown>;
  const result = await TestToolService({
    companyId,
    userId,
    toolId,
    toolInput:
      body.input && typeof body.input === "object"
        ? (body.input as Record<string, unknown>)
        : {},
    adminTestMode: body.adminTestMode === true
  });
  return res.json({ result });
};

export const getPolicies = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const policy = await GetToolPoliciesService({ companyId });
  return res.json({ policy });
};

export const updatePolicies = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const userId = userIdOrThrow(req);
  const body = (req.body || {}) as Record<string, unknown>;
  const policy = await UpsertToolPoliciesService({
    companyId,
    userId,
    enabled: body.enabled === true,
    maxRiskLevel: body.maxRiskLevel ? String(body.maxRiskLevel) : undefined,
    allowWrite: false,
    requireConfirmationFor: Array.isArray(body.requireConfirmationFor)
      ? (body.requireConfirmationFor as string[])
      : [],
    deniedToolIds: Array.isArray(body.deniedToolIds)
      ? (body.deniedToolIds as string[])
      : [],
    allowedToolIds: Array.isArray(body.allowedToolIds)
      ? (body.allowedToolIds as string[])
      : null,
    metadata:
      body.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, unknown>)
        : undefined
  });
  return res.json({ policy });
};

export const metrics = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await GetToolMetricsService({ companyId });
  return res.json(result);
};
