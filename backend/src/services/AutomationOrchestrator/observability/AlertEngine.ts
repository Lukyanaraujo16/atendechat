import {
  AgentOsAlert,
  newId
} from "./types";
import {
  AgentOsAlertType,
  AgentOsSeverity
} from "../../../config/automationAgentOsObservabilityConstants";
import { getObservabilityConfig } from "./ObservabilityConfig";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { AGENTOS_OBSERVABILITY_MODULE_KEY } from "../../../config/automationAgentOsObservabilityConstants";
import { agentOsLog } from "./StructuredLogger";

const alertsByCompany = new Map<number, AgentOsAlert[]>();
const failureStreak = new Map<string, number>();

function push(alert: AgentOsAlert): void {
  const cfg = getObservabilityConfig();
  const list = alertsByCompany.get(alert.companyId) || [];
  list.unshift(alert);
  if (list.length > cfg.maxInMemoryAlerts) list.length = cfg.maxInMemoryAlerts;
  alertsByCompany.set(alert.companyId, list);
  if (cfg.persistAlerts) {
    observabilityRepository.writeEventFireAndForget({
      companyId: alert.companyId,
      moduleKey: AGENTOS_OBSERVABILITY_MODULE_KEY,
      eventName: `alert.${alert.type}`,
      entityId: alert.alertId,
      payload: { ...alert } as any
    });
  }
  agentOsLog(alert.severity === "critical" ? "error" : "warn", {
    type: "alert",
    alertId: alert.alertId,
    alertType: alert.type,
    companyId: alert.companyId,
    traceId: alert.traceId
  });
}

export function raiseAgentOsAlert(input: {
  companyId: number;
  type: AgentOsAlertType;
  severity?: AgentOsSeverity;
  message: string;
  traceId?: string | null;
  metadata?: Record<string, unknown>;
}): AgentOsAlert {
  const alert: AgentOsAlert = {
    alertId: newId("alert"),
    type: input.type,
    severity: input.severity || "warn",
    companyId: input.companyId,
    traceId: input.traceId ?? null,
    message: input.message,
    metadata: input.metadata || {},
    createdAt: new Date().toISOString(),
    acknowledged: false
  };
  if (getObservabilityConfig().enabled) push(alert);
  return alert;
}

export function observeFailureForAlerts(input: {
  companyId: number;
  key: string;
  traceId?: string;
  latencyMs?: number;
  rateLimited?: boolean;
  timeout?: boolean;
  mcpDown?: boolean;
  loopDetected?: boolean;
  delegationBlocked?: boolean;
}): void {
  const cfg = getObservabilityConfig();
  const streakKey = `${input.companyId}:${input.key}`;
  const n = (failureStreak.get(streakKey) || 0) + 1;
  failureStreak.set(streakKey, n);
  if (n >= cfg.repeatedFailureThreshold) {
    raiseAgentOsAlert({
      companyId: input.companyId,
      type: "repeated_failures",
      severity: "error",
      message: `Falhas repetidas (${n}) em ${input.key}`,
      traceId: input.traceId,
      metadata: { key: input.key, count: n }
    });
    failureStreak.set(streakKey, 0);
  }
  if ((input.latencyMs || 0) >= cfg.latencyCriticalMs) {
    raiseAgentOsAlert({
      companyId: input.companyId,
      type: "high_latency",
      severity: "critical",
      message: `Latência crítica ${input.latencyMs}ms`,
      traceId: input.traceId,
      metadata: { latencyMs: input.latencyMs }
    });
  } else if ((input.latencyMs || 0) >= cfg.latencyWarnMs) {
    raiseAgentOsAlert({
      companyId: input.companyId,
      type: "high_latency",
      severity: "warn",
      message: `Latência elevada ${input.latencyMs}ms`,
      traceId: input.traceId,
      metadata: { latencyMs: input.latencyMs }
    });
  }
  if (input.rateLimited) {
    raiseAgentOsAlert({
      companyId: input.companyId,
      type: "rate_limit",
      severity: "warn",
      message: "Rate limit atingido",
      traceId: input.traceId
    });
  }
  if (input.timeout) {
    raiseAgentOsAlert({
      companyId: input.companyId,
      type: "timeout",
      severity: "error",
      message: "Timeout AgentOS",
      traceId: input.traceId
    });
  }
  if (input.mcpDown) {
    raiseAgentOsAlert({
      companyId: input.companyId,
      type: "mcp_unavailable",
      severity: "critical",
      message: "MCP indisponível",
      traceId: input.traceId
    });
  }
  if (input.loopDetected) {
    raiseAgentOsAlert({
      companyId: input.companyId,
      type: "loop_detected",
      severity: "critical",
      message: "Loop detectado",
      traceId: input.traceId
    });
  }
  if (input.delegationBlocked) {
    raiseAgentOsAlert({
      companyId: input.companyId,
      type: "delegation_blocked",
      severity: "warn",
      message: "Delegação bloqueada",
      traceId: input.traceId
    });
  }
}

export function acknowledgeAlert(companyId: number, alertId: string): boolean {
  const list = alertsByCompany.get(companyId) || [];
  const found = list.find(a => a.alertId === alertId);
  if (!found) return false;
  found.acknowledged = true;
  return true;
}

export function listAgentOsAlerts(
  companyId: number,
  opts?: { unacknowledgedOnly?: boolean; limit?: number }
): AgentOsAlert[] {
  let list = alertsByCompany.get(companyId) || [];
  if (opts?.unacknowledgedOnly) list = list.filter(a => !a.acknowledged);
  return list.slice(0, opts?.limit || 100);
}

export function resetAgentOsAlerts(companyId?: number): void {
  if (companyId == null) {
    alertsByCompany.clear();
    failureStreak.clear();
  } else alertsByCompany.delete(companyId);
}
