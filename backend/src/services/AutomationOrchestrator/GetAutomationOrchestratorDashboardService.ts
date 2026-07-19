import { Op } from "sequelize";
import AutomationExecution from "../../models/AutomationExecution";
import AutomationExecutionStep from "../../models/AutomationExecutionStep";
import AutomationPlannerValidation from "../../models/AutomationPlannerValidation";
import { registerBuiltinActions } from "./registerBuiltinActions";
import { listActionManifests } from "./ActionRegistry";
import { listCapabilities } from "./CapabilityRegistry";

export type GetAutomationOrchestratorDashboardInput = {
  companyId: number;
  dateFrom?: string | Date;
  dateTo?: string | Date;
};

export default async function GetAutomationOrchestratorDashboardService(
  input: GetAutomationOrchestratorDashboardInput
) {
  const where: Record<string, unknown> = {
    companyId: input.companyId
  };

  if (input.dateFrom || input.dateTo) {
    const createdAt: Record<symbol, Date> = {};
    if (input.dateFrom) {
      createdAt[Op.gte] = new Date(input.dateFrom);
    }
    if (input.dateTo) {
      createdAt[Op.lte] = new Date(input.dateTo);
    }
    where.createdAt = createdAt;
  }

  const executions = await AutomationExecution.findAll({
    where,
    attributes: [
      "id",
      "status",
      "intent",
      "controlMode",
      "ownership",
      "fallbackToLegacy",
      "circuitBreakerTripped",
      "startedAt",
      "finishedAt",
      "createdAt"
    ],
    raw: true
  });

  const byStatus: Record<string, number> = {};
  const byIntent: Record<string, number> = {};
  let durationSum = 0;
  let durationCount = 0;
  let waits = 0;
  let handoffs = 0;
  let flows = 0;
  let chatbot = 0;
  let ia = 0;
  let shadowExecutions = 0;
  let activeExecutions = 0;
  let fallbackExecutions = 0;
  let circuitBreakerTrips = 0;
  let ownershipTransfers = 0;

  for (const row of executions) {
    const status = String(row.status || "unknown");
    byStatus[status] = (byStatus[status] || 0) + 1;

    const intent = String(row.intent || "unknown");
    byIntent[intent] = (byIntent[intent] || 0) + 1;

    if (status === "waiting") waits += 1;
    if (status === "handoff" || intent === "human") handoffs += 1;
    if (intent === "flow") flows += 1;
    if (intent === "chatbot") chatbot += 1;
    if (intent === "live_agent" || intent === "knowledge") ia += 1;

    const mode = String(row.controlMode || "");
    if (mode === "shadow_execute") shadowExecutions += 1;
    if (mode === "active" || mode === "active_partial") activeExecutions += 1;
    if (row.fallbackToLegacy === true) fallbackExecutions += 1;
    if (row.circuitBreakerTripped === true) circuitBreakerTrips += 1;
    if (row.ownership === "orchestrator") ownershipTransfers += 1;

    if (row.startedAt && row.finishedAt) {
      const ms =
        new Date(row.finishedAt).getTime() - new Date(row.startedAt).getTime();
      if (Number.isFinite(ms) && ms >= 0) {
        durationSum += ms;
        durationCount += 1;
      }
    }
  }

  const executionIds = executions.map(e => e.id);
  const actionUsage: Record<string, number> = {};

  if (executionIds.length > 0) {
    const steps = await AutomationExecutionStep.findAll({
      where: {
        companyId: input.companyId,
        executionId: { [Op.in]: executionIds }
      },
      attributes: ["actionName"],
      raw: true
    });
    for (const step of steps) {
      const name = String(step.actionName || "unknown");
      actionUsage[name] = (actionUsage[name] || 0) + 1;
    }
  }

  let plannerMatches = 0;
  let plannerDivergences = 0;
  let criticalDivergences = 0;

  try {
    const validations = await AutomationPlannerValidation.findAll({
      where,
      attributes: ["matched", "divergenceSeverity"],
      raw: true
    });
    for (const v of validations) {
      if (v.matched === true) {
        plannerMatches += 1;
      } else {
        plannerDivergences += 1;
      }
      if (v.divergenceSeverity === "critical") {
        criticalDivergences += 1;
      }
    }
  } catch {
    // fail-open: métricas de validação opcionais
  }

  registerBuiltinActions();
  const manifests = listActionManifests();
  const capabilities = listCapabilities({ includeFuture: true });
  const avgDurationByAction: Record<string, number | null> = {};
  for (const name of Object.keys(actionUsage)) {
    avgDurationByAction[name] = null;
  }

  try {
    if (executionIds.length > 0) {
      const timedSteps = await AutomationExecutionStep.findAll({
        where: {
          companyId: input.companyId,
          executionId: { [Op.in]: executionIds },
          durationMs: { [Op.ne]: null }
        },
        attributes: ["actionName", "durationMs"],
        raw: true
      });
      const sum: Record<string, number> = {};
      const cnt: Record<string, number> = {};
      for (const step of timedSteps) {
        const name = String(step.actionName || "unknown");
        const ms = Number(step.durationMs);
        if (!Number.isFinite(ms) || ms < 0) continue;
        sum[name] = (sum[name] || 0) + ms;
        cnt[name] = (cnt[name] || 0) + 1;
      }
      for (const name of Object.keys(sum)) {
        avgDurationByAction[name] = Math.round(sum[name] / cnt[name]);
      }
    }
  } catch {
    // fail-open
  }

  const actionCatalog = {
    installed: manifests.length,
    experimental: manifests.filter(m => m.experimental).length,
    deprecated: manifests.filter(m => m.deprecated).length,
    capabilities: capabilities.length,
    futureCapabilities: capabilities.filter(c => c.future).length,
    manifests: manifests.map(m => ({
      id: m.id,
      name: m.name,
      version: m.version,
      category: m.category,
      capabilities: m.capabilities,
      sideEffects: m.sideEffects,
      deprecated: m.deprecated,
      experimental: m.experimental,
      timeoutMs: m.timeoutMs,
      usage: actionUsage[m.name] || 0,
      avgDurationMs: avgDurationByAction[m.name] ?? null
    })),
    capabilityDefs: capabilities.map(c => ({
      id: c.id,
      name: c.name,
      future: c.future,
      experimental: c.experimental,
      deprecated: c.deprecated
    })),
    avgDurationByAction
  };

  return {
    total: executions.length,
    byStatus,
    byIntent,
    actionUsage,
    avgDurationMs:
      durationCount > 0 ? Math.round(durationSum / durationCount) : null,
    waits,
    handoffs,
    flows,
    chatbot,
    ia,
    plannerMatches,
    plannerDivergences,
    criticalDivergences,
    shadowExecutions,
    activeExecutions,
    fallbackExecutions,
    circuitBreakerTrips,
    ownershipTransfers,
    actionCatalog
  };
}
