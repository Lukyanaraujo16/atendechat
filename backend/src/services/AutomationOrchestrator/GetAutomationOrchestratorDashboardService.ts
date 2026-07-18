import { Op } from "sequelize";
import AutomationExecution from "../../models/AutomationExecution";
import AutomationExecutionStep from "../../models/AutomationExecutionStep";
import AutomationPlannerValidation from "../../models/AutomationPlannerValidation";

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
    ownershipTransfers
  };
}
