import { logger } from "../../../../utils/logger";
import { DEFAULT_LIVE_HARDENING_CONFIG } from "../../../../config/automationLiveHardeningConstants";
import { getDistributedMetricsSnapshot } from "./DistributedMetricsStore";
import { getLiveRolloutMetricsSnapshot } from "../LiveRolloutMetrics";
import { getCircuitState } from "./DistributedCircuitBreaker";

export type ProductionAlert = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  at: string;
};

const recentByCompany = new Map<number, ProductionAlert[]>();

function push(companyId: number, alert: ProductionAlert): void {
  const list = recentByCompany.get(companyId) || [];
  list.unshift(alert);
  recentByCompany.set(companyId, list.slice(0, 100));
  logger.warn(
    { companyId, alert },
    `[LiveHardening][alert] ${alert.code}`
  );
}

/**
 * Production Alerts — regras determinísticas (sem IA).
 */
export async function evaluateProductionAlerts(
  companyId: number
): Promise<ProductionAlert[]> {
  const cfg = DEFAULT_LIVE_HARDENING_CONFIG.alerts;
  const live = getLiveRolloutMetricsSnapshot(companyId);
  const dist = await getDistributedMetricsSnapshot(companyId);
  const created: ProductionAlert[] = [];
  const now = new Date().toISOString();

  const latency = Math.max(live.averageLatency, dist.averageLatency || 0);
  if (latency >= cfg.latencyMs) {
    const a: ProductionAlert = {
      code: "HIGH_LATENCY",
      severity: "warning",
      message: `Latência média ${latency}ms acima do limiar ${cfg.latencyMs}ms.`,
      at: now
    };
    push(companyId, a);
    created.push(a);
  }

  const execs = Math.max(live.liveExecutions, dist.liveExecutions || 0);
  if (execs >= 10) {
    const fallbacks = Math.max(live.fallbacks, dist.fallbacks || 0);
    const rate = fallbacks / execs;
    if (rate >= cfg.fallbackRate) {
      const a: ProductionAlert = {
        code: "HIGH_FALLBACK_RATE",
        severity: "critical",
        message: `Fallback rate ${(rate * 100).toFixed(1)}%.`,
        at: now
      };
      push(companyId, a);
      created.push(a);
    }
  }

  if (live.toolCalls >= 10) {
    const fr = live.toolFailures / live.toolCalls;
    if (fr >= cfg.toolFailureRate) {
      const a: ProductionAlert = {
        code: "HIGH_TOOL_FAILURE",
        severity: "warning",
        message: `Tool failure rate ${(fr * 100).toFixed(1)}%.`,
        at: now
      };
      push(companyId, a);
      created.push(a);
    }
  }

  if (live.rollbacks >= cfg.rollbackCountHour || (dist.rollbacks || 0) >= cfg.rollbackCountHour) {
    const a: ProductionAlert = {
      code: "FREQUENT_ROLLBACKS",
      severity: "critical",
      message: `Rollbacks frequentes detectados.`,
      at: now
    };
    push(companyId, a);
    created.push(a);
  }

  if ((dist.timeouts || 0) >= 5) {
    const a: ProductionAlert = {
      code: "TIMEOUTS",
      severity: "warning",
      message: `Timeouts agregados: ${dist.timeouts}.`,
      at: now
    };
    push(companyId, a);
    created.push(a);
  }

  const cb = await getCircuitState({
    scope: "company",
    id: String(companyId)
  });
  if (cb.state === "Open") {
    const a: ProductionAlert = {
      code: "CIRCUIT_OPEN",
      severity: "critical",
      message: `Circuit breaker OPEN até ${new Date(cb.openUntil).toISOString()}.`,
      at: now
    };
    push(companyId, a);
    created.push(a);
  }

  return created;
}

export function listRecentAlerts(companyId: number): ProductionAlert[] {
  return [...(recentByCompany.get(companyId) || [])];
}

export function emitProductionAlert(input: {
  companyId: number;
  kind: string;
  message: string;
  severity?: ProductionAlert["severity"];
  meta?: Record<string, unknown>;
}): ProductionAlert {
  const alert: ProductionAlert = {
    code: String(input.kind).toUpperCase(),
    severity: input.severity || "warning",
    message: input.message,
    at: new Date().toISOString()
  };
  push(input.companyId, alert);
  if (input.meta) {
    logger.warn(
      { companyId: input.companyId, meta: input.meta },
      "[LiveHardening][alert_meta]"
    );
  }
  return alert;
}

export function __resetAlertsForTests(): void {
  recentByCompany.clear();
}

export default { evaluateProductionAlerts, listRecentAlerts, emitProductionAlert };
