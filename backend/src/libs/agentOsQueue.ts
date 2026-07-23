import BullQueue from "bull";
import { REDIS_URI_CONNECTION } from "../config/redis";
import { logger } from "../utils/logger";
import { AGENTOS_JOB_PAYLOAD_VERSION } from "../config/automationAgentOsProductionConstants";

const connection = REDIS_URI_CONNECTION || "";

/**
 * Fila Bull AgentOS — reutiliza Redis do projeto.
 * Não processar fora de startAgentOsQueueWorkers().
 */
export const agentOsQueue = new BullQueue("AgentOS", connection, {
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 }
  }
});

export async function enqueueAgentOsBullJob(input: {
  name: string;
  companyId?: number | null;
  payload?: Record<string, unknown>;
  correlationId?: string | null;
  delayMs?: number;
}) {
  return agentOsQueue.add(
    input.name,
    {
      v: AGENTOS_JOB_PAYLOAD_VERSION,
      companyId: input.companyId ?? null,
      correlationId: input.correlationId ?? null,
      payload: input.payload || {},
      enqueuedAt: new Date().toISOString()
    },
    { delay: input.delayMs || 0, jobId: undefined }
  );
}

export function startAgentOsQueueWorkers(): void {
  if (!connection) {
    logger.warn("[AgentOS] REDIS_URI ausente — workers AgentOS não iniciados");
    return;
  }

  agentOsQueue.process("observability_write", 2, async job => {
    return { ok: true, type: job.name };
  });
  agentOsQueue.process("metrics_aggregation", 1, async () => ({ ok: true }));
  agentOsQueue.process("alerts_evaluation", 1, async job => {
    if (job.data?.companyId) {
      const { evaluateCanary } = await import(
        "../services/AutomationOrchestrator/production/CanaryEvaluator"
      );
      return evaluateCanary(Number(job.data.companyId));
    }
    return { ok: true };
  });
  agentOsQueue.process("replay_rebuild", 1, async job => {
    const { rebuildExecutionFromPersistence } = await import(
      "../services/AutomationOrchestrator/observability/PersistentReplayService"
    );
    return rebuildExecutionFromPersistence({
      companyId: Number(job.data.companyId),
      traceId: String(job.data.payload?.traceId || "")
    });
  });
  agentOsQueue.process("retention_cleanup", 1, async () => {
    const { runIdempotencyCleanupBatch } = await import(
      "../services/AutomationOrchestrator/scalability/HealthProbes"
    );
    return runIdempotencyCleanupBatch();
  });
  agentOsQueue.process("consistency_validation", 1, async job => {
    const { validateAgentOsConsistency } = await import(
      "../services/AutomationOrchestrator/scalability/ConsistencyValidator"
    );
    return validateAgentOsConsistency(Number(job.data.companyId || 0));
  });
  agentOsQueue.process("canary_evaluation", 1, async job => {
    const { evaluateCanary } = await import(
      "../services/AutomationOrchestrator/production/CanaryEvaluator"
    );
    return evaluateCanary(Number(job.data.companyId));
  });
  agentOsQueue.process("hydrate_tenant", 1, async job => {
    const { hydrateAgentOsTenant } = await import(
      "../services/AutomationOrchestrator/production/DbFirstHydration"
    );
    return hydrateAgentOsTenant(Number(job.data.companyId));
  });

  logger.info("[AgentOS] Bull workers registrados");
}
