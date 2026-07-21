import { Op } from "sequelize";
import AppError from "../../../errors/AppError";
import AutomationToolExecution from "../../../models/AutomationToolExecution";
import AutomationToolPolicy from "../../../models/AutomationToolPolicy";
import hasPlanFeature from "../../../helpers/hasPlanFeature";
import {
  AUTOMATION_AI_TOOLS_FEATURE_KEY,
  AUTOMATION_TOOL_DEFAULT_CAPABILITIES,
  ToolRiskLevel
} from "../../../config/automationToolConstants";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../../../config/automationOrchestratorConstants";
import { registerBuiltinTools } from "./registerBuiltinTools";
import {
  discoverTools,
  getTool,
  getToolManifest,
  listTools,
  listToolVersions
} from "./ToolRegistry";
import { buildToolExecutionContext } from "./ToolExecutionContext";
import { runToolViaRuntime } from "./AutomationToolRuntime";
import { getToolMetricsSnapshot } from "./ToolMetrics";
import { getToolCircuitSnapshot } from "./ToolCircuitBreaker";
import { buildProviderToolDefinitions } from "./providers/buildProviderToolDefinitions";
import { emitToolEvent } from "./ToolEventBus";

export async function ensureToolsReady(): Promise<void> {
  registerBuiltinTools();
}

export async function getCompanyToolPolicy(companyId: number): Promise<{
  enabled: boolean;
  maxRiskLevel: ToolRiskLevel;
  allowWrite: boolean;
  requireConfirmationFor: ToolRiskLevel[];
  deniedToolIds: string[];
  allowedToolIds: string[] | null;
  metadata: Record<string, unknown> | null;
}> {
  const row = await AutomationToolPolicy.findOne({ where: { companyId } });
  if (!row) {
    return {
      enabled: false,
      maxRiskLevel: "read_only",
      allowWrite: false,
      requireConfirmationFor: [],
      deniedToolIds: [],
      allowedToolIds: null,
      metadata: null
    };
  }
  return {
    enabled: row.enabled === true,
    maxRiskLevel: (row.maxRiskLevel || "read_only") as ToolRiskLevel,
    allowWrite: row.allowWrite === true,
    requireConfirmationFor: (row.requireConfirmationFor ||
      []) as ToolRiskLevel[],
    deniedToolIds: (row.deniedToolIds || []) as string[],
    allowedToolIds: (row.allowedToolIds as string[] | null) || null,
    metadata: row.metadata || null
  };
}

export async function GetToolCatalogService(input: {
  companyId: number;
}): Promise<{
  tools: ReturnType<typeof listTools>;
  capabilities: typeof AUTOMATION_TOOL_DEFAULT_CAPABILITIES;
  providerSchemas: ReturnType<typeof buildProviderToolDefinitions>;
}> {
  await ensureToolsReady();
  const tools = listTools({
    includeExperimental: true,
    includeDeprecated: false
  });

  await emitToolEvent({
    companyId: input.companyId,
    eventName: "ToolDiscovered",
    payload: { count: tools.length }
  });

  return {
    tools,
    capabilities: { ...AUTOMATION_TOOL_DEFAULT_CAPABILITIES },
    providerSchemas: buildProviderToolDefinitions(tools)
  };
}

export async function ListToolExecutionsService(input: {
  companyId: number;
  toolId?: string;
  status?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: AutomationToolExecution[]; count: number }> {
  const where: Record<string, unknown> = { companyId: input.companyId };
  if (input.toolId) where.toolId = input.toolId;
  if (input.status) where.status = input.status;

  const { rows, count } = await AutomationToolExecution.findAndCountAll({
    where,
    limit: input.limit,
    offset: input.offset,
    order: [["createdAt", "DESC"]]
  });
  return { rows, count };
}

export async function GetToolExecutionService(input: {
  companyId: number;
  id: number;
}): Promise<AutomationToolExecution> {
  const row = await AutomationToolExecution.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!row) {
    throw new AppError("ERR_NO_PERMISSION", 404, "Execução de Tool não encontrada.");
  }
  return row;
}

export async function TestToolService(input: {
  companyId: number;
  userId: number;
  toolId: string;
  toolInput?: Record<string, unknown>;
  adminTestMode: boolean;
  /** preview | dry_run | execute — obrigatório para Tools de escrita */
  mode?: "preview" | "dry_run" | "execute";
  confirmed?: boolean;
}): Promise<unknown> {
  await ensureToolsReady();

  if (!input.adminTestMode) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Modo de teste explícito obrigatório (adminTestMode)."
    );
  }

  const tool = getTool(input.toolId);
  if (!tool) {
    throw new AppError("ERR_NO_PERMISSION", 404, "Tool não encontrada.");
  }
  const manifest = tool.manifest();
  const isWrite = manifest.sideEffectType === "database_write";
  const mode =
    input.mode ||
    (isWrite
      ? input.toolInput?.previewOnly === true
        ? "preview"
        : input.toolInput?.dryRun === true || input.toolInput?.execute !== true
          ? "dry_run"
          : "execute"
      : "execute");

  if (isWrite && !["preview", "dry_run", "execute"].includes(mode)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Tools de escrita exigem mode=preview|dry_run|execute."
    );
  }

  if (isWrite && mode === "execute" && input.confirmed !== true && input.toolInput?.confirmed !== true) {
    // execute real ainda pode retornar waiting_confirmation via Operation Runtime
  }

  const [hasAgent, hasTools, hasKnowledge] = await Promise.all([
    hasPlanFeature(input.companyId, AUTOMATION_ORCHESTRATOR_FEATURE_KEY),
    hasPlanFeature(input.companyId, AUTOMATION_AI_TOOLS_FEATURE_KEY),
    hasPlanFeature(input.companyId, "automation.knowledge_base")
  ]);

  const companyPolicy = await getCompanyToolPolicy(input.companyId);
  const maxRiskForWrite: ToolRiskLevel =
    mode === "execute" ? "medium" : "medium";
  const effectivePolicy = {
    ...companyPolicy,
    enabled: companyPolicy.enabled || (hasAgent && hasTools),
    maxRiskLevel: (isWrite
      ? maxRiskForWrite
      : companyPolicy.maxRiskLevel || "read_only") as ToolRiskLevel,
    allowWrite:
      isWrite && mode === "execute"
        ? companyPolicy.allowWrite === true
        : isWrite
          ? false
          : false
  };

  // Para preview/dry_run de escrita, elevar maxRisk sem allowWrite real
  if (isWrite && (mode === "preview" || mode === "dry_run")) {
    effectivePolicy.maxRiskLevel = "medium";
  }

  const permissions = [
    "aiTools.view",
    "aiTools.test",
    "aiTools.executeRead",
    ...(isWrite ? ["aiTools.executeWrite"] : [])
  ];

  const toolInput: Record<string, unknown> = {
    ...(input.toolInput || {})
  };
  if (isWrite) {
    if (mode === "preview") {
      toolInput.previewOnly = true;
      toolInput.dryRun = false;
      toolInput.execute = false;
    } else if (mode === "dry_run") {
      toolInput.previewOnly = false;
      toolInput.dryRun = true;
      toolInput.execute = false;
    } else {
      toolInput.previewOnly = false;
      toolInput.dryRun = false;
      toolInput.execute = true;
      if (input.confirmed === true) toolInput.confirmed = true;
    }
  }

  const confirmed =
    input.confirmed === true || toolInput.confirmed === true;

  const ctx = buildToolExecutionContext({
    companyId: input.companyId,
    userId: input.userId,
    controlMode: "active",
    source: "admin_test",
    adminTestMode: true,
    executionOwner: "orchestrator",
    capabilities: {
      "tool.read": true,
      "tool.write": isWrite,
      "tool.internal": true,
      "contact.read": true,
      "contact.write": isWrite,
      "ticket.read": true,
      "ticket.write": isWrite,
      "tag.write": isWrite,
      "note.write": isWrite,
      "queue.read": true,
      "user.read": true
    },
    permissions,
    featureFlags: {
      [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: hasAgent,
      [AUTOMATION_AI_TOOLS_FEATURE_KEY]: hasTools,
      "automation.knowledge_base": hasKnowledge
    },
    requestId: `admin-test-${Date.now()}`,
    correlationId: `admin-test-${input.companyId}-${input.toolId}`,
    metadata: {
      writeMode: isWrite ? mode : undefined,
      operationRuntime: isWrite,
      confirmationStatus: confirmed ? "approved" : undefined
    }
  });

  discoverTools({
    ctx,
    includeExperimental: true,
    capabilities: isWrite
      ? ["tool.read", "tool.write", "tool.internal"]
      : ["tool.read", "tool.internal"]
  });

  const result = await runToolViaRuntime({
    toolId: input.toolId,
    ctx,
    input: toolInput,
    companyPolicy: effectivePolicy,
    persist: true
  });

  const { toModelResult, diffInternalVsModel } = await import(
    "./ToolModelResultAdapter"
  );
  const modelResult =
    result.modelResult ||
    (toModelResult(result, input.toolId) as unknown as Record<string, unknown>);

  const data = (result.data || {}) as Record<string, unknown>;

  return {
    mode,
    internal: {
      status: result.status,
      data: result.data,
      displayData: result.displayData,
      metrics: result.metrics,
      logs: result.logs,
      warnings: result.warnings,
      errors: result.errors,
      audit: result.audit,
      executionId: result.executionId
    },
    model: modelResult,
    diff: diffInternalVsModel(result, modelResult as any),
    operation: isWrite
      ? {
          status: data.operationStatus,
          preview: data.preview,
          before: data.before,
          after: data.after,
          changedFields: data.changedFields,
          dryRun: data.dryRun,
          previewOnly: data.previewOnly,
          transaction: data.transaction,
          rollback: data.rollback,
          modelResult: data.modelResult,
          resultDiff: data.resultDiff
        }
      : null,
    comparison:
      isWrite && data.before && data.after
        ? { before: data.before, after: data.after, changedFields: data.changedFields }
        : null,
    manifest: {
      id: manifest.id,
      version: manifest.version,
      description: manifest.description,
      inputSchema: manifest.inputSchema,
      outputSchema: manifest.outputSchema,
      riskLevel: manifest.riskLevel,
      sideEffectType: manifest.sideEffectType,
      requiredPermissions: manifest.requiredPermissions,
      requiredFeatures: manifest.requiredFeatures,
      capabilities: manifest.capabilities
    },
    durationMs: result.metrics.durationMs
  };
}

export async function GetToolPoliciesService(input: {
  companyId: number;
}): Promise<ReturnType<typeof getCompanyToolPolicy>> {
  return getCompanyToolPolicy(input.companyId);
}

export async function UpsertToolPoliciesService(input: {
  companyId: number;
  userId: number;
  enabled?: boolean;
  maxRiskLevel?: string;
  allowWrite?: boolean;
  requireConfirmationFor?: string[];
  deniedToolIds?: string[];
  allowedToolIds?: string[] | null;
  metadata?: Record<string, unknown>;
}): Promise<ReturnType<typeof getCompanyToolPolicy>> {
  const allowedRisk: ToolRiskLevel[] = [
    "read_only",
    "low",
    "medium"
  ];
  const maxRiskLevel = allowedRisk.includes(
    input.maxRiskLevel as ToolRiskLevel
  )
    ? (input.maxRiskLevel as ToolRiskLevel)
    : "read_only";
  // 2.1C: allowWrite explícito permitido (ainda deny-by-default se omitido)
  const allowWrite = input.allowWrite === true;

  const [row] = await AutomationToolPolicy.findOrCreate({
    where: { companyId: input.companyId },
    defaults: {
      companyId: input.companyId,
      enabled: false,
      maxRiskLevel: "read_only",
      allowWrite: false,
      requireConfirmationFor: [],
      deniedToolIds: [],
      allowedToolIds: null,
      updatedBy: input.userId
    }
  });

  await row.update({
    enabled: input.enabled === true,
    maxRiskLevel,
    allowWrite,
    requireConfirmationFor: input.requireConfirmationFor || [],
    deniedToolIds: input.deniedToolIds || [],
    allowedToolIds: input.allowedToolIds ?? null,
    metadata: input.metadata || row.metadata,
    updatedBy: input.userId
  });

  return getCompanyToolPolicy(input.companyId);
}

export async function GetToolMetricsService(input: {
  companyId: number;
}): Promise<{
  metrics: ReturnType<typeof getToolMetricsSnapshot>;
  catalog: Array<{
    id: string;
    version: string;
    riskLevel: string;
    sideEffectType: string;
    versions: string[];
    circuit: ReturnType<typeof getToolCircuitSnapshot>;
  }>;
}> {
  await ensureToolsReady();
  const tools = listTools({ includeExperimental: true });
  return {
    metrics: getToolMetricsSnapshot(input.companyId),
    catalog: tools.map(t => ({
      id: t.id,
      version: t.version,
      riskLevel: t.riskLevel,
      sideEffectType: t.sideEffectType,
      versions: listToolVersions(t.id),
      circuit: getToolCircuitSnapshot(input.companyId, t.id, t.version)
    }))
  };
}

export async function ListToolExecutionsForAutomationReplay(input: {
  companyId: number;
  automationExecutionId: number;
}): Promise<AutomationToolExecution[]> {
  return AutomationToolExecution.findAll({
    where: {
      companyId: input.companyId,
      automationExecutionId: input.automationExecutionId
    },
    order: [["createdAt", "ASC"]]
  });
}

export function getToolManifestSafe(toolId: string) {
  return getToolManifest(toolId) || null;
}

export async function countRecentToolFailures(input: {
  companyId: number;
  since: Date;
}): Promise<number> {
  return AutomationToolExecution.count({
    where: {
      companyId: input.companyId,
      status: { [Op.in]: ["failure", "denied"] },
      createdAt: { [Op.gte]: input.since }
    }
  });
}
