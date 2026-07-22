import { Op } from "sequelize";
import { logger } from "../../../../utils/logger";
import { DEFAULT_LIVE_HARDENING_CONFIG } from "../../../../config/automationLiveHardeningConstants";
import AiAgentEvidenceReport from "../../../../models/AiAgentEvidenceReport";
import AiAgentRuntimeLog from "../../../../models/AiAgentRuntimeLog";
import { redisPing } from "../../../../libs/cache";
import { getDistributedMetricsSnapshot } from "./DistributedMetricsStore";
import { getCircuitState } from "./DistributedCircuitBreaker";
import { listRecentAlerts } from "./ProductionAlerts";
import { getLiveRolloutMetricsSnapshot } from "../LiveRolloutMetrics";
import { loadLiveRolloutConfig } from "../LiveRolloutConfigService";
import { AUTOMATION_LIVE_HARDENING_VERSION } from "../../../../config/automationLiveHardeningConstants";

/**
 * Runtime Health Check — multi-instance consistency signals.
 */
export async function getLiveHardeningHealth(input: {
  companyId: number;
}): Promise<Record<string, unknown>> {
  const redisOk = await redisPing();
  const config = await loadLiveRolloutConfig(input.companyId);
  const metricsLocal = getLiveRolloutMetricsSnapshot(input.companyId);
  const metricsDist = await getDistributedMetricsSnapshot(input.companyId);
  const circuit = await getCircuitState({
    scope: "company",
    id: String(input.companyId)
  });
  const alerts = listRecentAlerts(input.companyId);

  return {
    version: AUTOMATION_LIVE_HARDENING_VERSION,
    status: redisOk && circuit.state !== "Open" ? "healthy" : "degraded",
    redis: redisOk,
    multiInstance: {
      metricsBackend: redisOk ? "redis+memory" : "memory_only",
      circuitBackend: redisOk ? "redis+memory" : "memory_only",
      consistent: redisOk
    },
    stage: config.stage,
    percent: config.percent,
    allowWriteToolsLive: false,
    circuit,
    metricsLocal,
    metricsDistributed: metricsDist,
    alerts: alerts.slice(0, 10),
    retention: DEFAULT_LIVE_HARDENING_CONFIG.retention
  };
}

/**
 * Retention cleanup — evidence + runtime logs antigos.
 */
export async function runLiveHardeningCleanup(input?: {
  companyId?: number;
}): Promise<{
  evidenceDeleted: number;
  runtimeDeleted: number;
}> {
  const r = DEFAULT_LIVE_HARDENING_CONFIG.retention;
  const evidenceCutoff = new Date(
    Date.now() - r.evidenceDays * 24 * 60 * 60 * 1000
  );
  const runtimeCutoff = new Date(
    Date.now() - r.runtimeLogDays * 24 * 60 * 60 * 1000
  );

  const evidenceWhere: Record<string, unknown> = {
    createdAt: { [Op.lt]: evidenceCutoff }
  };
  const runtimeWhere: Record<string, unknown> = {
    createdAt: { [Op.lt]: runtimeCutoff }
  };
  if (input?.companyId) {
    evidenceWhere.companyId = input.companyId;
    runtimeWhere.companyId = input.companyId;
  }

  let evidenceDeleted = 0;
  let runtimeDeleted = 0;
  try {
    evidenceDeleted = await AiAgentEvidenceReport.destroy({
      where: evidenceWhere
    });
  } catch (err) {
    logger.warn({ err }, "[LiveHardening] evidence_cleanup_failed");
  }
  try {
    // Somente logs live/shadow antigos — não apaga tudo agressivamente
    runtimeDeleted = await AiAgentRuntimeLog.destroy({
      where: {
        ...runtimeWhere,
        channel: { [Op.in]: ["live", "shadow"] }
      } as any
    });
  } catch (err) {
    logger.warn({ err }, "[LiveHardening] runtime_cleanup_failed");
  }

  logger.info(
    { evidenceDeleted, runtimeDeleted, companyId: input?.companyId },
    "[LiveHardening] cleanup_done"
  );

  return { evidenceDeleted, runtimeDeleted };
}

export default { getLiveHardeningHealth, runLiveHardeningCleanup };
