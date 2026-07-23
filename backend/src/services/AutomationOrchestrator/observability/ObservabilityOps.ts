import { rebuildExecutionFromPersistence, reprocessReplay } from "./PersistentReplayService";
import {
  getObservabilityMetrics,
  recalculateObservabilityMetrics,
  resetObservabilityMetrics
} from "./ObservabilityMetricsStore";
import { buildAgentOsHealth } from "./HealthAggregator";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { emitAgentOsEvent } from "./AgentOsEventBus";
import { createTraceContext } from "./types";
import { agentOsLog } from "./StructuredLogger";

export async function runObservabilityOps(input: {
  companyId: number;
  userId?: number | null;
  operation:
    | "reprocess_replay"
    | "recalculate_metrics"
    | "reindex_documents"
    | "validate_consistency"
    | "health_check";
  traceId?: string;
}) {
  const ctx = createTraceContext({ companyId: input.companyId });
  emitAgentOsEvent({
    ctx,
    type: `ops.${input.operation}`,
    origin: "ops",
    severity: "info",
    payload: { traceId: input.traceId ?? null }
  });
  agentOsLog("info", {
    type: "ops",
    operation: input.operation,
    companyId: input.companyId,
    userId: input.userId ?? null
  });

  switch (input.operation) {
    case "reprocess_replay": {
      if (!input.traceId) throw new Error("ERR_OBS_TRACE_REQUIRED");
      return {
        operation: input.operation,
        result: await reprocessReplay({
          companyId: input.companyId,
          traceId: input.traceId
        })
      };
    }
    case "recalculate_metrics": {
      const metrics = recalculateObservabilityMetrics(input.companyId);
      return { operation: input.operation, result: metrics };
    }
    case "reindex_documents": {
      // Observabilidade apenas — não altera indexação cognitiva; registra job simbólico.
      return {
        operation: input.operation,
        result: {
          status: "queued_noop",
          message:
            "Reindexação documental registrada (sem mudança cognitiva Wave 3)",
          at: new Date().toISOString()
        }
      };
    }
    case "validate_consistency": {
      const metrics = getObservabilityMetrics(input.companyId);
      const audits = await observabilityRepository.listAudits(input.companyId, {
        limit: 20
      });
      const health = buildAgentOsHealth(input.companyId);
      return {
        operation: input.operation,
        result: {
          health: health.status,
          metricsOk: metrics != null,
          auditsSample: (audits || []).length,
          consistent: health.status !== "Critical"
        }
      };
    }
    case "health_check":
      return {
        operation: input.operation,
        result: buildAgentOsHealth(input.companyId)
      };
    default:
      throw new Error("ERR_OBS_UNKNOWN_OP");
  }
}

export function resetObservabilityForTests(companyId?: number): void {
  resetObservabilityMetrics(companyId);
}
