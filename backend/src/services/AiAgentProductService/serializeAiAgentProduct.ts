import {
  AiAgentProductReadiness,
  AiAgentProductSummary,
  AiAgentNextAction,
  AgentProductStatus,
  AiAgentProductMode,
  AiAgentProductCheck,
  AiAgentProductCommand,
  AiAgentProductCommandResult,
  AiAgentProductConnectionScope,
  AiAgentProductAffectedConnections,
  AiAgentProductAgentScope
} from "../../types/aiAgentProduct";
import { emptyConnectionScope } from "./aiAgentProductConnectionScope";
import { emptyAgentScope } from "./ResolveAiAgentProductContextService";

const ALLOWED_SUMMARY_ROOT = new Set([
  "availability",
  "status",
  "mode",
  "agent",
  "connection",
  "connectionScope",
  "agentScope",
  "readiness"
]);

const ALLOWED_AVAILABILITY = new Set(["enabledByPlan", "accessibleByUser"]);
const ALLOWED_AGENT = new Set(["exists", "id", "name", "enabled"]);
const ALLOWED_CONNECTION = new Set(["linked", "name", "connected"]);
const ALLOWED_CONNECTION_SCOPE = new Set([
  "type",
  "count",
  "connectedCount",
  "disconnectedCount",
  "names"
]);
const ALLOWED_AGENT_SCOPE = new Set(["type", "count"]);
const ALLOWED_AFFECTED = new Set([
  "scope",
  "count",
  "names",
  "fromMode",
  "toMode"
]);
const ALLOWED_COMMAND_RESULT = new Set([
  "command",
  "changed",
  "affectedConnections",
  "summary"
]);
const ALLOWED_READINESS = new Set([
  "ready",
  "status",
  "mode",
  "nextAction",
  "checks"
]);
const ALLOWED_CHECK = new Set(["key", "status", "labelKey"]);

const FORBIDDEN_KEY_FRAGMENTS = [
  "apikey",
  "apikeymasked",
  "credentialid",
  "systemprompt",
  "prompt",
  "providercredential",
  "trace",
  "metadata",
  "execution",
  "planning",
  "policy",
  "token",
  "secret",
  "companyid",
  "stack",
  "password",
  "whatsappid",
  "session"
];

function assertAllowlistedObject(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`Serializer leak: unexpected key ${path}.${key}`);
    }
    const lower = key.toLowerCase();
    for (const bad of FORBIDDEN_KEY_FRAGMENTS) {
      if (lower.includes(bad)) {
        throw new Error(`Serializer leak: forbidden key ${path}.${key}`);
      }
    }
  }
}

function serializeChecks(
  checks: AiAgentProductCheck[] | undefined
): AiAgentProductCheck[] {
  return (checks || []).map(c => {
    const row: AiAgentProductCheck = {
      key: c.key,
      status: c.status,
      labelKey: String(c.labelKey || "")
    };
    assertAllowlistedObject(
      row as unknown as Record<string, unknown>,
      ALLOWED_CHECK,
      "check"
    );
    return row;
  });
}

export function serializeAiAgentConnectionScope(
  scope: AiAgentProductConnectionScope | undefined
): AiAgentProductConnectionScope {
  const base = scope || emptyConnectionScope();
  const out: AiAgentProductConnectionScope = {
    type: "all_linked",
    count: Math.max(0, Number(base.count) || 0),
    connectedCount: Math.max(0, Number(base.connectedCount) || 0),
    disconnectedCount: Math.max(0, Number(base.disconnectedCount) || 0),
    names: Array.isArray(base.names)
      ? base.names.map(n => String(n || "").trim() || "—").slice(0, 50)
      : []
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_CONNECTION_SCOPE,
    "connectionScope"
  );
  return out;
}

export function serializeAiAgentAgentScope(
  scope: AiAgentProductAgentScope | undefined
): AiAgentProductAgentScope {
  const base = scope || emptyAgentScope();
  const type =
    base.type === "single" || base.type === "ambiguous" || base.type === "none"
      ? base.type
      : "none";
  const out: AiAgentProductAgentScope = {
    type,
    count: Math.max(0, Number(base.count) || 0)
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_AGENT_SCOPE,
    "agentScope"
  );
  return out;
}

export function serializeAffectedConnections(
  affected: AiAgentProductAffectedConnections
): AiAgentProductAffectedConnections {
  const out: AiAgentProductAffectedConnections = {
    scope: "all_linked",
    count: Math.max(0, Number(affected.count) || 0),
    names: Array.isArray(affected.names)
      ? affected.names.map(n => String(n || "").trim() || "—").slice(0, 50)
      : [],
    fromMode: affected.fromMode,
    toMode: affected.toMode
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_AFFECTED,
    "affectedConnections"
  );
  return out;
}

export function serializeAiAgentReadiness(
  readiness: AiAgentProductReadiness
): AiAgentProductReadiness {
  const out: AiAgentProductReadiness = {
    ready: readiness.ready === true,
    status: readiness.status,
    mode: readiness.mode,
    nextAction: readiness.nextAction,
    checks: serializeChecks(readiness.checks)
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_READINESS,
    "readiness"
  );
  return out;
}

export function serializeUnavailableProductSummary(input: {
  enabledByPlan: boolean;
  accessibleByUser: boolean;
  nextAction?: AiAgentNextAction;
}): AiAgentProductSummary {
  const status: AgentProductStatus = "unavailable";
  const mode: AiAgentProductMode = "off";
  const nextAction: AiAgentNextAction = input.nextAction || "upgrade_plan";
  return serializeAiAgentProductSummary({
    availability: {
      enabledByPlan: input.enabledByPlan === true,
      accessibleByUser: input.accessibleByUser === true
    },
    status,
    mode,
    agent: { exists: false },
    connection: { linked: false },
    connectionScope: emptyConnectionScope(),
    agentScope: emptyAgentScope(),
    readiness: {
      ready: false,
      status,
      mode,
      nextAction,
      checks: [
        {
          key: "plan",
          status: "blocked",
          labelKey: "aiAgentProduct.checks.plan"
        }
      ]
    }
  });
}

export function serializeAiAgentProductSummary(
  summary: AiAgentProductSummary
): AiAgentProductSummary {
  const agentExists = summary.agent?.exists === true;
  const out: AiAgentProductSummary = {
    availability: {
      enabledByPlan: summary.availability?.enabledByPlan === true,
      accessibleByUser: summary.availability?.accessibleByUser === true
    },
    status: summary.status,
    mode: summary.mode,
    agent: agentExists
      ? {
          exists: true,
          ...(summary.agent.id != null ? { id: Number(summary.agent.id) } : {}),
          ...(summary.agent.name != null
            ? { name: String(summary.agent.name) }
            : {}),
          // enabled só no preview single (com id); ambíguo não escolhe agente
          ...(summary.agent.id != null
            ? { enabled: summary.agent.enabled === true }
            : {})
        }
      : { exists: false },
    connection: {
      linked: summary.connection?.linked === true,
      ...(summary.connection?.linked
        ? {
            ...(summary.connection.name != null
              ? { name: String(summary.connection.name) }
              : {}),
            connected: summary.connection.connected === true
          }
        : {})
    },
    connectionScope: serializeAiAgentConnectionScope(summary.connectionScope),
    agentScope: serializeAiAgentAgentScope(summary.agentScope),
    readiness: serializeAiAgentReadiness(summary.readiness)
  };

  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_SUMMARY_ROOT,
    "summary"
  );
  assertAllowlistedObject(
    out.availability as unknown as Record<string, unknown>,
    ALLOWED_AVAILABILITY,
    "availability"
  );
  assertAllowlistedObject(
    out.agent as unknown as Record<string, unknown>,
    ALLOWED_AGENT,
    "agent"
  );
  assertAllowlistedObject(
    out.connection as unknown as Record<string, unknown>,
    ALLOWED_CONNECTION,
    "connection"
  );

  return out;
}

export function serializeAiAgentProductCommandResult(input: {
  command: AiAgentProductCommand;
  changed: boolean;
  affectedConnections: AiAgentProductAffectedConnections;
  summary: AiAgentProductSummary;
}): AiAgentProductCommandResult {
  const out: AiAgentProductCommandResult = {
    command: input.command,
    changed: input.changed === true,
    affectedConnections: serializeAffectedConnections(input.affectedConnections),
    summary: serializeAiAgentProductSummary(input.summary)
  };
  assertAllowlistedObject(
    out as unknown as Record<string, unknown>,
    ALLOWED_COMMAND_RESULT,
    "commandResult"
  );
  return out;
}

/** Lista de chaves raiz permitidas — para testes de contrato. */
export const AI_AGENT_PRODUCT_SUMMARY_ALLOWED_KEYS = [...ALLOWED_SUMMARY_ROOT];
