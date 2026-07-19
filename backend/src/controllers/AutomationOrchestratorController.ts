import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  AUTOMATION_CONTROL_MODES,
  AUTOMATION_ACTION_RUNTIME_VERSION,
  AutomationControlMode
} from "../config/automationOrchestratorConstants";
import ListAutomationExecutionsService from "../services/AutomationOrchestrator/ListAutomationExecutionsService";
import GetAutomationExecutionService from "../services/AutomationOrchestrator/GetAutomationExecutionService";
import GetAutomationOrchestratorDashboardService from "../services/AutomationOrchestrator/GetAutomationOrchestratorDashboardService";
import { ContinueAutomationExecutionService } from "../services/AutomationOrchestrator/ContinueAutomationExecutionService";
import { StartAutomationExecutionService } from "../services/AutomationOrchestrator/StartAutomationExecutionService";
import { buildExecutionContextFromInbound } from "../services/AutomationOrchestrator/buildExecutionContext";
import {
  getActionManifest,
  listActionManifests
} from "../services/AutomationOrchestrator/ActionRegistry";
import { listCapabilities } from "../services/AutomationOrchestrator/CapabilityRegistry";
import { registerBuiltinActions } from "../services/AutomationOrchestrator/registerBuiltinActions";
import {
  ResolveOrchestratorSettingsService,
  UpsertOrchestratorSettingsService
} from "../services/AutomationOrchestrator/activation/ResolveOrchestratorSettingsService";
import ListAutomationValidationsService from "../services/AutomationOrchestrator/ListAutomationValidationsService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
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

function parsePage(raw: unknown): { limit: number; offset: number } {
  const page = Math.max(1, Number(raw) || 1);
  const limit = 20;
  return { limit, offset: (page - 1) * limit };
}

export const dashboard = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await GetAutomationOrchestratorDashboardService({
    companyId,
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined
  });
  return res.json(result);
};

export const listExecutions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { limit, offset } = parsePage(req.query.pageNumber);
  const result = await ListAutomationExecutionsService({
    companyId,
    ticketId: parseOptionalId(req.query.ticketId),
    status: req.query.status ? String(req.query.status) : undefined,
    intent: req.query.intent ? String(req.query.intent) : undefined,
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
  const execution = await GetAutomationExecutionService({
    companyId,
    executionId: id
  });
  return res.json({ execution });
};

export const replayExecution = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const execution = await GetAutomationExecutionService({
    companyId,
    executionId: id
  });
  const steps = ((execution as unknown as { steps?: unknown[] }).steps ||
    []) as Array<Record<string, unknown>>;
  const events = ((execution as unknown as { events?: unknown[] }).events ||
    []) as unknown[];
  const validation = (
    execution as unknown as { plannerValidation?: unknown }
  ).plannerValidation;
  return res.json({
    replay: {
      id: execution.id,
      status: execution.status,
      intent: execution.intent,
      plannerVersion: execution.plannerVersion,
      controlMode: execution.controlMode,
      ownership: execution.ownership,
      capabilitiesSnapshot: execution.capabilitiesSnapshot,
      fallbackToLegacy: execution.fallbackToLegacy,
      circuitBreakerTripped: execution.circuitBreakerTripped,
      plannerValidationId: execution.plannerValidationId,
      plannerValidation: validation || null,
      plan: execution.plan,
      graph: execution.graph,
      steps,
      events,
      timeline: steps.map(s => {
        const preview =
          s.outputPreview && typeof s.outputPreview === "object"
            ? (s.outputPreview as Record<string, unknown>)
            : {};
        const manifest =
          getActionManifest(String(s.actionName || "")) || null;
        return {
          at: s.startedAt || s.createdAt,
          action: s.actionName,
          result: s.resultStatus,
          durationMs: s.durationMs,
          errorCode: s.errorCode,
          manifest: manifest
            ? {
                id: manifest.id,
                version: manifest.version,
                category: manifest.category,
                capabilities: manifest.capabilities,
                timeoutMs: manifest.timeoutMs,
                retryPolicy: manifest.retryPolicy
              }
            : null,
          runtime: {
            version: AUTOMATION_ACTION_RUNTIME_VERSION,
            timeoutMs: preview.timeoutMs ?? null,
            retryPolicy: preview.retryPolicy ?? null,
            metrics: preview.runtimeMetrics ?? null,
            actionVersion: preview.actionVersion ?? null,
            actionCategory: preview.actionCategory ?? null,
            capabilities: preview.capabilities ?? null
          }
        };
      }),
      startedAt: execution.startedAt,
      finishedAt: execution.finishedAt
    }
  });
};

export const getSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const settings = await ResolveOrchestratorSettingsService({
    companyId,
    whatsappId: parseOptionalId(req.query.whatsappId),
    aiAgentId: parseOptionalId(req.query.aiAgentId)
  });
  return res.json({ settings });
};

export const updateSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rawMode = req.body?.controlMode;
  let controlMode: AutomationControlMode | undefined;
  if (rawMode != null) {
    if (
      !(AUTOMATION_CONTROL_MODES as readonly string[]).includes(String(rawMode))
    ) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "controlMode inválido."
      );
    }
    controlMode = rawMode as AutomationControlMode;
  }

  const settings = await UpsertOrchestratorSettingsService({
    companyId,
    whatsappId: parseOptionalId(req.body?.whatsappId) ?? null,
    aiAgentId: parseOptionalId(req.body?.aiAgentId) ?? null,
    controlMode,
    capabilities: req.body?.capabilities ?? null,
    enabled: req.body?.enabled,
    circuitBreakerOpenUntil: req.body?.circuitBreakerOpenUntil
      ? new Date(req.body.circuitBreakerOpenUntil)
      : undefined,
    metadata: req.body?.metadata ?? null,
    updatedBy:
      req.user?.id != null && Number.isFinite(Number(req.user.id))
        ? Number(req.user.id)
        : null
  });
  return res.json({ settings });
};

export const listValidations = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { limit, offset } = parsePage(req.query.pageNumber);
  const matchedRaw = req.query.matched;
  let matched: boolean | undefined;
  if (matchedRaw === "true" || matchedRaw === "1") matched = true;
  if (matchedRaw === "false" || matchedRaw === "0") matched = false;

  const result = await ListAutomationValidationsService({
    companyId,
    matched,
    divergenceSeverity: req.query.divergenceSeverity
      ? String(req.query.divergenceSeverity)
      : undefined,
    limit,
    offset
  });
  return res.json({
    records: result.rows,
    count: result.count,
    hasMore: result.count > offset + result.rows.length
  });
};

export const activationMetrics = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await GetAutomationOrchestratorDashboardService({
    companyId,
    dateFrom: req.query.dateFrom ? String(req.query.dateFrom) : undefined,
    dateTo: req.query.dateTo ? String(req.query.dateTo) : undefined
  });
  return res.json({
    plannerMatches: result.plannerMatches,
    plannerDivergences: result.plannerDivergences,
    criticalDivergences: result.criticalDivergences,
    shadowExecutions: result.shadowExecutions,
    activeExecutions: result.activeExecutions,
    fallbackExecutions: result.fallbackExecutions,
    circuitBreakerTrips: result.circuitBreakerTrips,
    ownershipTransfers: result.ownershipTransfers,
    total: result.total
  });
};

export const listActionsCatalog = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  registerBuiltinActions();
  const manifests = listActionManifests();
  const capabilities = listCapabilities({ includeFuture: true });
  return res.json({
    runtimeVersion: AUTOMATION_ACTION_RUNTIME_VERSION,
    actions: manifests.map(m => ({
      id: m.id,
      name: m.name,
      version: m.version,
      category: m.category,
      capabilities: m.capabilities,
      description: m.description,
      sideEffects: m.sideEffects,
      supportsObserve: m.supportsObserve,
      supportsShadow: m.supportsShadow,
      supportsActive: m.supportsActive,
      timeoutMs: m.timeoutMs,
      retryPolicy: m.retryPolicy,
      rollbackSupported: m.rollbackSupported,
      deprecated: m.deprecated,
      experimental: m.experimental,
      owner: m.owner,
      tags: m.tags,
      manifest: m
    })),
    capabilities
  });
};

export const continueExecution = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const execution = await ContinueAutomationExecutionService({
    companyId,
    executionId: id,
    message: {
      body: req.body?.messageBody ?? req.body?.body,
      messageId: req.body?.messageId,
      hasText: req.body?.hasText,
      fromMe: req.body?.fromMe
    }
  });
  return res.json({ execution });
};

/** Simulação admin em observe — não assume atendimento. */
export const simulatePlan = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const ticketId = parseOptionalId(req.body?.ticketId);
  const messageId =
    req.body?.messageId || `sim-orch-${companyId}-${Date.now()}`;

  const ctx = buildExecutionContextFromInbound({
    companyId,
    channel: "admin_simulate",
    messageId,
    controlMode: "observe",
    ticket: {
      id: ticketId || 0,
      status: String(req.body?.ticketStatus || "pending"),
      userId: req.body?.userId ?? null,
      chatbot: Boolean(req.body?.chatbot),
      queueId: req.body?.queueId ?? null,
      aiAgentId: req.body?.aiAgentId ?? null,
      aiAgentPaused: Boolean(req.body?.aiAgentPaused),
      aiAgentHandoffRequested: Boolean(req.body?.handoffRequested),
      isGroup: false
    },
    contact: {
      id: Number(req.body?.contactId) || 0,
      name: req.body?.contactName || null
    },
    whatsapp: {
      id: Number(req.body?.whatsappId) || 0,
      aiAgentId: req.body?.aiAgentId ?? null,
      aiAgentMode: req.body?.runtimeMode || "live"
    },
    currentMessage: {
      body: String(req.body?.body || "mensagem de teste"),
      fromMe: false,
      hasText: true
    },
    integrationActive: Boolean(req.body?.integrationActive),
    metadata: { source: "admin_simulate" }
  });

  const execution = await StartAutomationExecutionService({
    companyId,
    channel: "admin_simulate",
    messageId,
    ticketId: ticketId ?? null,
    contactId: ctx.contactId,
    whatsappId: ctx.whatsappId,
    controlMode: "observe",
    executionContext: ctx,
    metadata: { source: "admin_simulate" },
    runEngine: true
  });

  if (!execution) {
    throw new AppError(
      "ERR_AUTOMATION_DISABLED",
      400,
      "Orchestrator desabilitado para esta empresa."
    );
  }

  return res.status(201).json({ execution });
};
