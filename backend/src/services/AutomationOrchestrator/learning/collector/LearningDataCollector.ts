import { createHash } from "crypto";
import { getLearningConfig } from "../LearningConfig";
import { evaluateLearningDataQuality } from "./LearningDataQualityEvaluator";
import {
  ExecutionHistorySample,
  LearningDataset,
  LearningEvidence
} from "../types";
import { LearningScopeType } from "../../../../config/automationLearningConstants";

const SECRET_KEYS = /token|secret|password|authorization|api[_-]?key|credential|cookie/i;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (value.length > 500) return `${value.slice(0, 500)}…`;
    return value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(v => sanitizeValue(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEYS.test(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = sanitizeValue(v, depth + 1);
    }
  }
  return out;
}

function eid(seed: string): string {
  return `lev_${createHash("sha256").update(seed).digest("hex").slice(0, 12)}`;
}

function sampleToEvidence(
  companyId: number,
  sample: ExecutionHistorySample,
  index: number
): LearningEvidence[] {
  const ts = sample.timestamp || new Date().toISOString();
  const base = {
    timestamp: ts,
    confidence: 0.7,
    weight: 1,
    tenantVerified: true,
    sanitized: true,
    metadata: { companyId }
  };
  const items: LearningEvidence[] = [];

  items.push({
    id: eid(`${companyId}:session:${sample.sessionId || index}:${ts}`),
    sourceType: "SESSION",
    sourceId: sample.sessionId || sample.executionId || `sample_${index}`,
    eventType: sample.status || "unknown",
    summary: sample.summary || `Execution ${sample.status || "unknown"}`,
    structuredData: sanitizeValue({
      capability: sample.capability,
      runtimeType: sample.runtimeType,
      toolId: sample.toolId,
      status: sample.status,
      errorCode: sample.errorCode,
      latencyMs: sample.latencyMs,
      cost: sample.cost,
      recovery: sample.recovery,
      replan: sample.replan,
      humanIntervention: sample.humanIntervention,
      fallbackUsed: sample.fallbackUsed,
      policyDenied: sample.policyDenied,
      strategy: sample.strategy
    }) as Record<string, unknown>,
    ...base
  });

  if (sample.runtimeType || sample.toolId) {
    items.push({
      id: eid(`${companyId}:runtime:${sample.executionId || index}:${ts}`),
      sourceType: "RUNTIME",
      sourceId: sample.executionId || `rt_${index}`,
      eventType: sample.runtimeType || "TOOL_RUNTIME",
      summary: `Runtime ${sample.runtimeType || "TOOL_RUNTIME"} → ${sample.status}`,
      structuredData: sanitizeValue({
        runtimeType: sample.runtimeType,
        toolId: sample.toolId,
        capability: sample.capability,
        fallbackUsed: sample.fallbackUsed
      }) as Record<string, unknown>,
      ...base
    });
  }

  if (sample.mcpServerId || sample.mcpTool) {
    items.push({
      id: eid(`${companyId}:mcp:${sample.mcpTool || index}:${ts}`),
      sourceType: "MCP",
      sourceId: sample.mcpTool || sample.mcpServerId || `mcp_${index}`,
      eventType: sample.status === "failure" ? "MCP_FAILURE" : "MCP_RESULT",
      summary: `MCP ${sample.mcpTool || "tool"} ${sample.status}`,
      structuredData: sanitizeValue({
        serverId: sample.mcpServerId,
        tool: sample.mcpTool,
        errorCode: sample.errorCode,
        latencyMs: sample.latencyMs
      }) as Record<string, unknown>,
      ...base
    });
  }

  if (sample.recovery || sample.replan || sample.humanIntervention) {
    items.push({
      id: eid(`${companyId}:feedback:${sample.executionId || index}:${ts}`),
      sourceType: "FEEDBACK",
      sourceId: sample.executionId || `fb_${index}`,
      eventType: sample.recovery
        ? "RECOVERY"
        : sample.replan
          ? "REPLAN"
          : "HUMAN_INTERVENTION",
      summary: "Feedback signals from execution",
      structuredData: {
        recovery: !!sample.recovery,
        replan: !!sample.replan,
        humanIntervention: !!sample.humanIntervention
      },
      ...base
    });
  }

  return items;
}

/**
 * LearningDataCollector — coleta evidências sanitizadas, tenant-scoped.
 * Não executa tools/MCP. Não coleta segredos.
 */
export function collectLearningDataset(input: {
  companyId: number;
  agentId?: number | null;
  scopeType: LearningScopeType;
  scopeId: string;
  samples: ExecutionHistorySample[];
  periodStart?: string;
  periodEnd?: string;
}): LearningDataset {
  const cfg = getLearningConfig(input.companyId);
  const samples = (input.samples || [])
    .filter(s => (s.agentId == null || input.agentId == null || s.agentId === input.agentId))
    .slice(0, cfg.maxSamplesPerAnalysis);

  const evidence: LearningEvidence[] = [];
  for (let i = 0; i < samples.length; i += 1) {
    evidence.push(...sampleToEvidence(input.companyId, samples[i], i));
  }

  const successCount = samples.filter(s => s.status === "success").length;
  const failureCount = samples.filter(s => s.status === "failure").length;
  const partialCount = samples.filter(s => s.status === "partial").length;
  const recoveryCount = samples.filter(s => s.recovery).length;
  const replanCount = samples.filter(s => s.replan).length;
  const humanInterventionCount = samples.filter(s => s.humanIntervention).length;

  const byCapability: Record<string, number> = {};
  const byRuntime: Record<string, number> = {};
  const byError: Record<string, number> = {};
  for (const s of samples) {
    if (s.capability) byCapability[s.capability] = (byCapability[s.capability] || 0) + 1;
    if (s.runtimeType) byRuntime[s.runtimeType] = (byRuntime[s.runtimeType] || 0) + 1;
    if (s.errorCode) byError[s.errorCode] = (byError[s.errorCode] || 0) + 1;
  }

  const now = new Date().toISOString();
  const dataQuality = evaluateLearningDataQuality({
    companyId: input.companyId,
    sampleSize: samples.length,
    evidence,
    successCount,
    failureCount,
    partialCount,
    humanInterventionCount,
    uniqueCapabilities: Object.keys(byCapability).length,
    uniqueSessions: new Set(samples.map(s => s.sessionId).filter(Boolean)).size
  });

  return {
    id: `lds_${createHash("sha256")
      .update(`${input.companyId}:${input.scopeType}:${input.scopeId}:${now}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId: input.companyId,
    agentId: input.agentId ?? null,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    sourceSessionIds: [
      ...new Set(samples.map(s => s.sessionId).filter(Boolean) as string[])
    ],
    sourceGoalIds: [
      ...new Set(samples.map(s => s.goalId).filter(Boolean) as string[])
    ],
    sourceExecutionIds: [
      ...new Set(samples.map(s => s.executionId).filter(Boolean) as string[])
    ],
    periodStart: input.periodStart || samples[0]?.timestamp || now,
    periodEnd: input.periodEnd || samples[samples.length - 1]?.timestamp || now,
    sampleSize: samples.length,
    successCount,
    failureCount,
    partialCount,
    recoveryCount,
    replanCount,
    humanInterventionCount,
    evidence,
    statistics: {
      byCapability,
      byRuntime,
      byError,
      successRate: samples.length ? successCount / samples.length : 0,
      failureRate: samples.length ? failureCount / samples.length : 0
    },
    dataQuality,
    createdAt: now,
    metadata: {
      sanitized: true,
      liveIntegrationEnabled: false,
      executesTools: false,
      executesMcp: false
    }
  };
}

export { sanitizeValue };

export default { collectLearningDataset, sanitizeValue };
