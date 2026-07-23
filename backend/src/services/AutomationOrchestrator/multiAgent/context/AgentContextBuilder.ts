import { createHash } from "crypto";
import { AgentProfile, SpecializedAgentContext } from "../types";
import { resolveAgentToolBoundary } from "../policies/AgentToolBoundaryResolver";
import { emitMultiAgentEvent } from "../MultiAgentEvents";
import { multiAgentStore } from "../stores/MultiAgentStore";

const SECRET_RE = /token|secret|password|api[_-]?key|credential|authorization/i;

/**
 * Precedência:
 * 1 System Security 2 Tenant 3 Runtime 4 Agent Boundary 5 Agent Instructions
 * 6 Goal 7 Conversation 8 User Input
 */
export function composeAgentInstructions(input: {
  agent: AgentProfile;
  tenantPolicies?: string;
  runtimePolicies?: string;
  goalContext?: string;
  conversationContext?: string;
  userInput?: string;
}): { composed: string; sanitized: string; layers: string[] } {
  const layers = [
    "[SYSTEM_SECURITY] Never bypass tenant, RBAC, confirmation, tool or MCP policies.",
    `[TENANT_POLICIES] ${input.tenantPolicies || "Apply company policies."}`,
    `[RUNTIME_POLICIES] ${input.runtimePolicies || "Respect runtime boundaries and timeouts."}`,
    `[AGENT_BOUNDARY] role=${input.agent.role} specialization=${input.agent.specialization} capabilities=${input.agent.capabilities.join(",")}`,
    `[AGENT_INSTRUCTIONS] ${input.agent.systemInstructions}\n${input.agent.businessInstructions}`,
    `[GOAL_CONTEXT] ${input.goalContext || ""}`,
    `[CONVERSATION_CONTEXT] ${input.conversationContext || ""}`,
    `[USER_INPUT] ${input.userInput || ""}`
  ];
  const composed = layers.filter(Boolean).join("\n\n");
  const sanitized = composed
    .split("\n")
    .map(line => (SECRET_RE.test(line) ? "[redacted-line]" : line))
    .join("\n")
    .slice(0, 8000);
  return { composed, sanitized, layers };
}

export function buildSpecializedAgentContext(input: {
  companyId: number;
  agent: AgentProfile;
  routingDecisionId?: string | null;
  goalContext?: string;
  conversationContext?: string;
  userInput?: string;
}): SpecializedAgentContext {
  const boundary = resolveAgentToolBoundary({
    companyId: input.companyId,
    agent: input.agent
  });
  const instructions = composeAgentInstructions({
    agent: input.agent,
    goalContext: input.goalContext,
    conversationContext: input.conversationContext,
    userInput: input.userInput
  });

  const ctx: SpecializedAgentContext = {
    companyId: input.companyId,
    agentId: input.agent.id,
    agentVersion: input.agent.version,
    agentRole: input.agent.role,
    specialization: input.agent.specialization,
    instructions: instructions.sanitized,
    allowedCapabilities: boundary.allowedCapabilities,
    allowedTools: boundary.allowedTools,
    allowedMcpServers: boundary.allowedMcpServers,
    allowedMcpTools: boundary.allowedMcpTools,
    memoryPolicy: input.agent.memoryPolicy,
    learningPolicy: {
      ...input.agent.learningPolicy,
      metadata: {
        ...input.agent.learningPolicy.metadata,
        autoPromotion: false,
        shareLearningWithinTenant: false
      }
    },
    delegationPolicy: input.agent.delegationPolicy,
    handoffPolicy: input.agent.handoffPolicy,
    runtimePreferences: {},
    strategyPreferences: {},
    executionLimits: input.agent.executionLimits,
    routingDecisionId: input.routingDecisionId ?? null,
    composedInstructionsSanitized: instructions.sanitized,
    metadata: {
      sharedKernel: true,
      liveIntegrationEnabled: false,
      boundaryDenials: boundary.denials,
      instructionLayers: instructions.layers.length
    }
  };

  const key = `${input.companyId}:${input.agent.id}:${input.routingDecisionId || "none"}`;
  multiAgentStore(input.companyId).putSpecializedContext(key, ctx);
  emitMultiAgentEvent(input.companyId, "AGENT_CONTEXT_CREATED", input.agent.id, {
    version: input.agent.version
  });
  return ctx;
}

export function sanitizeAgentPayload(
  payload: Record<string, unknown>
): { sanitized: Record<string, unknown>; removed: string[] } {
  const removed: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload || {})) {
    if (SECRET_RE.test(k)) {
      removed.push(k);
      out[k] = "[redacted]";
    } else if (typeof v === "object" && v && !Array.isArray(v)) {
      const nested = sanitizeAgentPayload(v as Record<string, unknown>);
      out[k] = nested.sanitized;
      removed.push(...nested.removed.map(r => `${k}.${r}`));
    } else {
      out[k] = typeof v === "string" && v.length > 1000 ? `${v.slice(0, 1000)}…` : v;
    }
  }
  return { sanitized: out, removed };
}

export function buildContextBoundary(input: {
  companyId: number;
  sourceAgentId: string;
  targetAgentId: string;
  sourceSessionId: string;
  sharingLevel?: string;
  task?: string;
  goal?: string;
  extra?: Record<string, unknown>;
}) {
  const level = input.sharingLevel || "TASK_ONLY";
  const allowedFields =
    level === "MINIMAL"
      ? ["task"]
      : level === "TASK_ONLY"
        ? ["task", "goal", "expectedOutput"]
        : level === "GOAL_CONTEXT"
          ? ["task", "goal", "goalType"]
          : level === "TICKET_CONTEXT"
            ? ["task", "goal", "ticketId", "queueId"]
            : level === "CONTACT_CONTEXT"
              ? ["task", "goal", "contactId"]
              : level === "SESSION_SUMMARY"
                ? ["task", "goal", "sessionSummary"]
                : ["task", "goal"];

  const raw = {
    task: input.task || "",
    goal: input.goal || "",
    ...(input.extra || {})
  };
  const { sanitized, removed } = sanitizeAgentPayload(raw);
  const payload: Record<string, unknown> = {};
  for (const f of allowedFields) {
    if (sanitized[f] !== undefined) payload[f] = sanitized[f];
  }

  const boundary = {
    id: `acb_${createHash("sha256")
      .update(`${input.companyId}:${input.sourceSessionId}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId: input.companyId,
    sourceAgentId: input.sourceAgentId,
    targetAgentId: input.targetAgentId,
    sourceSessionId: input.sourceSessionId,
    allowedFields,
    blockedFields: ["credentials", "tokens", "headers", "stack", ...removed],
    memoryScopes: ["EXECUTION_SCOPED" as const],
    knowledgeObjectIds: [],
    ticketFields: allowedFields.includes("ticketId") ? ["id", "status"] : [],
    contactFields: allowedFields.includes("contactId") ? ["id", "name"] : [],
    goalFields: allowedFields.filter(f => f.startsWith("goal") || f === "goal"),
    executionFields: ["task"],
    conversationWindow: 0,
    sensitiveFieldsRemoved: removed,
    sanitizationApplied: true,
    sharingLevel: level as any,
    payload,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    metadata: { fullSessionShared: false }
  };
  multiAgentStore(input.companyId).putBoundary(boundary);
  return boundary;
}

export default {
  composeAgentInstructions,
  buildSpecializedAgentContext,
  sanitizeAgentPayload,
  buildContextBoundary
};
