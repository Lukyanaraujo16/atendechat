import { createHash } from "crypto";
import { McpAuditEntry, McpExecutionRecord } from "./types";
import { getMcpConfig } from "./McpConfig";

const audits: McpAuditEntry[] = [];
const executions: McpExecutionRecord[] = [];
const MAX = 500;

export type McpMetricsSnapshot = {
  serversConfigured: number;
  serversEnabled: number;
  healthyServers: number;
  degradedServers: number;
  unhealthyServers: number;
  catalogSyncs: number;
  toolsDiscovered: number;
  toolsEnabled: number;
  readTools: number;
  writeTools: number;
  unknownTools: number;
  requests: number;
  successes: number;
  failures: number;
  timeouts: number;
  policyDenials: number;
  confirmationsRequired: number;
  fallbacks: number;
  averageLatency: number;
  requestsByServer: Record<string, number>;
  requestsByTool: Record<string, number>;
  errorsByCode: Record<string, number>;
};

const metrics = {
  catalogSyncs: 0,
  requests: 0,
  successes: 0,
  failures: 0,
  timeouts: 0,
  policyDenials: 0,
  confirmationsRequired: 0,
  fallbacks: 0,
  latencySum: 0,
  requestsByServer: {} as Record<string, number>,
  requestsByTool: {} as Record<string, number>,
  errorsByCode: {} as Record<string, number>
};

export function recordMcpMetric(
  kind:
    | "request"
    | "success"
    | "failure"
    | "timeout"
    | "policyDenial"
    | "confirmation"
    | "fallback"
    | "catalogSync",
  meta?: { serverId?: string; toolName?: string; errorCode?: string; latencyMs?: number }
): void {
  if (kind === "catalogSync") metrics.catalogSyncs += 1;
  if (kind === "request") {
    metrics.requests += 1;
    if (meta?.serverId) {
      metrics.requestsByServer[meta.serverId] =
        (metrics.requestsByServer[meta.serverId] || 0) + 1;
    }
    if (meta?.toolName) {
      metrics.requestsByTool[meta.toolName] =
        (metrics.requestsByTool[meta.toolName] || 0) + 1;
    }
  }
  if (kind === "success") metrics.successes += 1;
  if (kind === "failure") {
    metrics.failures += 1;
    if (meta?.errorCode) {
      metrics.errorsByCode[meta.errorCode] =
        (metrics.errorsByCode[meta.errorCode] || 0) + 1;
    }
  }
  if (kind === "timeout") metrics.timeouts += 1;
  if (kind === "policyDenial") metrics.policyDenials += 1;
  if (kind === "confirmation") metrics.confirmationsRequired += 1;
  if (kind === "fallback") metrics.fallbacks += 1;
  if (meta?.latencyMs != null) metrics.latencySum += meta.latencyMs;
}

export function recordMcpAudit(entry: Omit<McpAuditEntry, "id">): McpAuditEntry {
  const cfg = getMcpConfig(entry.companyId);
  const full: McpAuditEntry = {
    ...entry,
    id: `mcpaud_${createHash("sha256")
      .update(`${entry.companyId}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    resultSummary: entry.resultSummary.slice(0, cfg.auditPayloadLimit)
  };
  audits.push(full);
  if (audits.length > MAX) audits.shift();
  return full;
}

export function recordMcpExecution(record: McpExecutionRecord): void {
  executions.push(record);
  if (executions.length > MAX) executions.shift();
}

export function listMcpAudits(companyId: number, limit = 50): McpAuditEntry[] {
  return audits.filter(a => a.companyId === companyId).slice(-limit).reverse();
}

export function listMcpExecutions(
  companyId: number,
  limit = 50
): McpExecutionRecord[] {
  return executions
    .filter(e => e.companyId === companyId)
    .slice(-limit)
    .reverse();
}

export function findMcpExecution(
  companyId: number,
  id: string
): McpExecutionRecord | null {
  return (
    executions.find(e => e.companyId === companyId && e.id === id) || null
  );
}

export function getMcpMetricsBase(): typeof metrics {
  return metrics;
}

export function __resetMcpMetricsForTests(): void {
  metrics.catalogSyncs = 0;
  metrics.requests = 0;
  metrics.successes = 0;
  metrics.failures = 0;
  metrics.timeouts = 0;
  metrics.policyDenials = 0;
  metrics.confirmationsRequired = 0;
  metrics.fallbacks = 0;
  metrics.latencySum = 0;
  metrics.requestsByServer = {};
  metrics.requestsByTool = {};
  metrics.errorsByCode = {};
  audits.length = 0;
  executions.length = 0;
}

export default {
  recordMcpMetric,
  recordMcpAudit,
  getMcpMetricsBase
};
