import {
  AiAgentProductReadiness,
  AiAgentProductSummary,
  AiAgentNextAction,
  AgentProductStatus,
  AiAgentProductMode,
  AiAgentProductCheck
} from "../../types/aiAgentProduct";

const ALLOWED_SUMMARY_ROOT = new Set([
  "availability",
  "status",
  "mode",
  "agent",
  "connection",
  "readiness"
]);

const ALLOWED_AVAILABILITY = new Set(["enabledByPlan", "accessibleByUser"]);
const ALLOWED_AGENT = new Set(["exists", "id", "name", "enabled"]);
const ALLOWED_CONNECTION = new Set(["linked", "name", "connected"]);
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
  "password"
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
          enabled: summary.agent.enabled === true
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

/** Lista de chaves raiz permitidas — para testes de contrato. */
export const AI_AGENT_PRODUCT_SUMMARY_ALLOWED_KEYS = [...ALLOWED_SUMMARY_ROOT];
