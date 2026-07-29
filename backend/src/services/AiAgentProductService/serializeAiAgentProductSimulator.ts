import {
  AiAgentProductSimulatorBootstrap,
  AiAgentProductSimulatorMessage,
  AiAgentProductSimulatorReview,
  AiAgentProductSimulatorSession,
  AiAgentProductSimulatorUnavailableReason,
  AiAgentProductAgentScope,
  AgentProductStatus,
  AiAgentProductMode
} from "../../types/aiAgentProduct";
import {
  encodeSimulatorMessageRef,
  encodeSimulatorSessionRef
} from "./aiAgentProductSimulatorHelpers";
import { resolveAiAgentProductProviderLabel } from "./aiAgentProductProviderCapabilities";
import { emptyAgentScope } from "./ResolveAiAgentProductContextService";

const ALLOWED_REVIEW = new Set(["rating", "tags", "note", "reviewedAt"]);
const ALLOWED_MESSAGE = new Set([
  "ref",
  "role",
  "content",
  "createdAt",
  "responseTimeMs",
  "handoffSuggested",
  "review"
]);
const ALLOWED_SESSION = new Set([
  "ref",
  "status",
  "providerLabel",
  "modelLabel",
  "messageCount",
  "startedAt",
  "endedAt",
  "averageResponseTimeMs",
  "messages"
]);
const ALLOWED_BOOTSTRAP = new Set([
  "available",
  "reason",
  "agentScope",
  "agent",
  "capabilities",
  "provider",
  "scenarioSegment",
  "sessions"
]);

const FORBIDDEN_FRAGMENTS = [
  "apikey",
  "credentialid",
  "systemprompt",
  "prompttokens",
  "completiontokens",
  "totaltokens",
  "functioncalling",
  "companyid",
  "agentid",
  "aiagentid",
  "sessionid",
  "reviewedby",
  "trace",
  "metadata",
  "secret",
  "token"
];

function assertAllowlisted(
  value: Record<string, unknown>,
  allowed: Set<string>,
  path: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`Serializer leak: unexpected key ${path}.${key}`);
    }
    const lower = key.toLowerCase();
    for (const bad of FORBIDDEN_FRAGMENTS) {
      if (lower.includes(bad)) {
        throw new Error(`Serializer leak: forbidden key ${path}.${key}`);
      }
    }
  }
}

function toIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function serializeAiAgentProductSimulatorReview(
  review: {
    rating?: string | null;
    tags?: string[] | null;
    note?: string | null;
    reviewedAt?: unknown;
    updatedAt?: unknown;
  } | null | undefined
): AiAgentProductSimulatorReview | null {
  if (!review) return null;
  const out: AiAgentProductSimulatorReview = {
    rating: String(review.rating || ""),
    tags: Array.isArray(review.tags)
      ? review.tags.map(t => String(t || "")).filter(Boolean)
      : [],
    note: review.note != null && String(review.note).trim() !== ""
      ? String(review.note)
      : null,
    reviewedAt: toIso(review.reviewedAt ?? review.updatedAt)
  };
  assertAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_REVIEW,
    "review"
  );
  return out;
}

export function serializeAiAgentProductSimulatorMessage(message: {
  id: number;
  role?: string | null;
  content?: string | null;
  createdAt?: unknown;
  latencyMs?: number | null;
  responseTimeMs?: number | null;
  handoffSuggested?: boolean | null;
  review?: Parameters<typeof serializeAiAgentProductSimulatorReview>[0];
}): AiAgentProductSimulatorMessage {
  const responseTimeMs =
    message.responseTimeMs != null
      ? Number(message.responseTimeMs)
      : message.latencyMs != null
        ? Number(message.latencyMs)
        : null;
  const out: AiAgentProductSimulatorMessage = {
    ref: encodeSimulatorMessageRef(message.id),
    role: String(message.role || ""),
    content: String(message.content ?? ""),
    createdAt: toIso(message.createdAt),
    responseTimeMs:
      responseTimeMs != null && Number.isFinite(responseTimeMs)
        ? responseTimeMs
        : null,
    handoffSuggested: message.handoffSuggested === true,
    review: serializeAiAgentProductSimulatorReview(message.review)
  };
  assertAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_MESSAGE,
    "message"
  );
  return out;
}

function averageResponseTimeMsFromMessages(
  messages: Array<{ role?: string | null; latencyMs?: number | null }>
): number | null {
  const assistant = messages.filter(m => m.role === "assistant");
  if (assistant.length === 0) return null;
  const sum = assistant.reduce((acc, m) => acc + (Number(m.latencyMs) || 0), 0);
  return Math.round(sum / assistant.length);
}

export function serializeAiAgentProductSimulatorSession(
  session: {
    id: number;
    status?: string | null;
    provider?: string | null;
    model?: string | null;
    providerLabel?: string | null;
    modelLabel?: string | null;
    messageCount?: number | null;
    startedAt?: unknown;
    endedAt?: unknown;
    averageLatencyMs?: number | null;
    averageResponseTimeMs?: number | null;
    messages?: Array<{
      id: number;
      role?: string | null;
      content?: string | null;
      createdAt?: unknown;
      latencyMs?: number | null;
      handoffSuggested?: boolean | null;
      review?: Parameters<typeof serializeAiAgentProductSimulatorReview>[0];
    }>;
  },
  opts?: { includeMessages?: boolean }
): AiAgentProductSimulatorSession {
  const includeMessages = opts?.includeMessages === true;
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const avg =
    session.averageResponseTimeMs != null
      ? Number(session.averageResponseTimeMs)
      : session.averageLatencyMs != null
        ? Number(session.averageLatencyMs)
        : includeMessages
          ? averageResponseTimeMsFromMessages(messages)
          : null;

  const out: AiAgentProductSimulatorSession = {
    ref: encodeSimulatorSessionRef(session.id),
    status: String(session.status || ""),
    providerLabel:
      session.providerLabel != null
        ? String(session.providerLabel)
        : resolveAiAgentProductProviderLabel(session.provider),
    modelLabel:
      session.modelLabel != null
        ? String(session.modelLabel)
        : session.model
          ? String(session.model)
          : null,
    messageCount: Math.max(0, Number(session.messageCount) || 0),
    startedAt: toIso(session.startedAt),
    endedAt: toIso(session.endedAt),
    averageResponseTimeMs:
      avg != null && Number.isFinite(avg) ? avg : null
  };

  if (includeMessages) {
    out.messages = messages.map(serializeAiAgentProductSimulatorMessage);
  }

  assertAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_SESSION,
    "session"
  );
  return out;
}

export function serializeAiAgentProductSimulatorBootstrap(input: {
  available: boolean;
  reason: AiAgentProductSimulatorUnavailableReason | null;
  agentScope?: AiAgentProductAgentScope;
  agent?: {
    name?: string | null;
    description?: string | null;
    status?: AgentProductStatus | null;
    mode?: AiAgentProductMode | null;
  };
  capabilities?: { canSimulate?: boolean; canReview?: boolean };
  provider?: { label?: string | null; modelLabel?: string | null };
  scenarioSegment?: string | null;
  sessions?: AiAgentProductSimulatorSession[];
}): AiAgentProductSimulatorBootstrap {
  const out: AiAgentProductSimulatorBootstrap = {
    available: input.available === true,
    reason: input.available ? null : input.reason || "simulator_not_configured",
    agentScope: input.agentScope || emptyAgentScope(),
    agent: {
      name: input.agent?.name != null ? String(input.agent.name) : null,
      description:
        input.agent?.description != null
          ? String(input.agent.description)
          : null,
      status: input.agent?.status ?? null,
      mode: input.agent?.mode ?? null
    },
    capabilities: {
      canSimulate: input.capabilities?.canSimulate === true,
      canReview: input.capabilities?.canReview === true
    },
    provider: {
      label: input.provider?.label != null ? String(input.provider.label) : null,
      modelLabel:
        input.provider?.modelLabel != null
          ? String(input.provider.modelLabel)
          : null
    },
    scenarioSegment:
      input.scenarioSegment != null && String(input.scenarioSegment).trim() !== ""
        ? String(input.scenarioSegment)
        : null,
    sessions: Array.isArray(input.sessions) ? input.sessions : []
  };
  assertAllowlisted(
    out as unknown as Record<string, unknown>,
    ALLOWED_BOOTSTRAP,
    "bootstrap"
  );
  return out;
}

export function serializeAiAgentProductSimulatorSendResult(input: {
  userMessage: Parameters<typeof serializeAiAgentProductSimulatorMessage>[0];
  assistantMessage: Parameters<typeof serializeAiAgentProductSimulatorMessage>[0];
  session: {
    id: number;
    status?: string | null;
    provider?: string | null;
    model?: string | null;
    messageCount?: number | null;
    startedAt?: unknown;
    endedAt?: unknown;
  };
}): {
  userMessage: AiAgentProductSimulatorMessage;
  assistantMessage: AiAgentProductSimulatorMessage;
  session: AiAgentProductSimulatorSession;
} {
  return {
    userMessage: serializeAiAgentProductSimulatorMessage(input.userMessage),
    assistantMessage: serializeAiAgentProductSimulatorMessage(
      input.assistantMessage
    ),
    session: serializeAiAgentProductSimulatorSession(input.session)
  };
}
