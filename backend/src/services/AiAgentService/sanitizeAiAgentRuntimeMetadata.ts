import { AI_AGENT_EVALUATOR_VERSION } from "./aiAgentDryRunConfig";

const ALLOWED_KEYS = new Set([
  "messageType",
  "hasText",
  "hasMedia",
  "messageIdSource",
  "ticketStatus",
  "hasUser",
  "ticketChatbot",
  "ticketQueueId",
  "isGroup",
  "integrationType",
  "flowWebhook",
  "hasFlowId",
  "evaluationDurationMs",
  "evaluatorVersion",
  "credentialSource",
  "credentialId",
  "flowEvidence",
  "integrationEvidence"
]);

const SENSITIVE_KEY_PATTERN =
  /(body|phone|token|apikey|api_key|password|secret|prompt|url|vcard|transcript|mediaurl|signed)/i;

function sanitizeEvidence(
  value: unknown
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    if (typeof val === "string" && val.length > 120) continue;
    if (typeof val === "boolean" || typeof val === "number" || val === null) {
      out[key] = val;
    } else if (typeof val === "string") {
      out[key] = val.slice(0, 120);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Remove campos sensíveis e limita metadata ao conjunto permitido.
 */
export function sanitizeAiAgentRuntimeMetadata(
  raw: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  const input = raw && typeof raw === "object" ? raw : {};
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (key === "evaluatorVersion") continue;
    if (key === "credentialId") {
      if (typeof value === "number" && Number.isFinite(value)) {
        out.credentialId = Math.floor(value);
      }
      continue;
    }
    if (key === "credentialSource") {
      if (
        value === "agent_credential" ||
        value === "company_default" ||
        value === "legacy_prompt" ||
        value === "missing"
      ) {
        out.credentialSource = value;
      }
      continue;
    }
    if (key === "flowEvidence" || key === "integrationEvidence") {
      const sanitized = sanitizeEvidence(value);
      if (sanitized) out[key] = sanitized;
      continue;
    }
    if (
      typeof value === "boolean" ||
      typeof value === "number" ||
      value === null
    ) {
      out[key] = value;
    } else if (typeof value === "string" && value.length <= 120) {
      out[key] = value;
    }
  }

  out.evaluatorVersion = AI_AGENT_EVALUATOR_VERSION;
  return out;
}
