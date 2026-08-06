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
  "integrationEvidence",
  "handoffRequested",
  "handoffReason",
  "handoffMarkerDetected",
  "handoffAppliedAt",
  "cleanResponseLength",
  "knowledge",
  "mediaType",
  "mediaByteSize",
  "mediaImageCount",
  "mediaTranscribed",
  "mediaTranscriptionChars",
  "mediaErrorCode",
  "mediaAskRetry",
  "mediaTechnicalCode",
  "visionFalseDenialDetected",
  "visionFalseDenialRetried",
  "visionFalseDenialFallback",
  "runtimeMode"
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

function sanitizeKnowledgeMeta(
  value: unknown
): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const metricsRaw =
    raw.metrics && typeof raw.metrics === "object" && !Array.isArray(raw.metrics)
      ? (raw.metrics as Record<string, unknown>)
      : {};
  const sources = Array.isArray(raw.sources)
    ? raw.sources.slice(0, 12).map((s: unknown) => {
        if (!s || typeof s !== "object") return null;
        const row = s as Record<string, unknown>;
        return {
          knowledgeBaseId: row.knowledgeBaseId ?? null,
          knowledgeBaseName:
            typeof row.knowledgeBaseName === "string"
              ? row.knowledgeBaseName.slice(0, 120)
              : null,
          documentId: row.documentId ?? null,
          documentTitle:
            typeof row.documentTitle === "string"
              ? row.documentTitle.slice(0, 120)
              : null,
          sectionTitle:
            typeof row.sectionTitle === "string"
              ? row.sectionTitle.slice(0, 120)
              : null,
          chunkId: row.chunkId ?? null,
          similarityScore:
            typeof row.similarityScore === "number" ? row.similarityScore : null,
          documentType:
            typeof row.documentType === "string" ? row.documentType : null
        };
      }).filter(Boolean)
    : [];

  return {
    enabled: Boolean(raw.enabled),
    performed: Boolean(raw.performed),
    status: typeof raw.status === "string" ? raw.status.slice(0, 32) : null,
    skippedReason:
      typeof raw.skippedReason === "string"
        ? raw.skippedReason.slice(0, 64)
        : null,
    knowledgeMissing: Boolean(raw.knowledgeMissing),
    suggestHandoff: Boolean(raw.suggestHandoff),
    sourceCount:
      typeof raw.sourceCount === "number" ? raw.sourceCount : sources.length,
    maxScore: typeof raw.maxScore === "number" ? raw.maxScore : null,
    retrievalId: typeof raw.retrievalId === "number" ? raw.retrievalId : null,
    errorCode: typeof raw.errorCode === "string" ? raw.errorCode.slice(0, 64) : null,
    queryUsed:
      typeof raw.queryUsed === "string" ? raw.queryUsed.slice(0, 200) : "",
    sources,
    metrics: {
      durationMs: typeof metricsRaw.durationMs === "number" ? metricsRaw.durationMs : 0,
      returnedChunkCount:
        typeof metricsRaw.returnedChunkCount === "number"
          ? metricsRaw.returnedChunkCount
          : 0,
      provider:
        typeof metricsRaw.provider === "string"
          ? metricsRaw.provider.slice(0, 32)
          : "",
      model:
        typeof metricsRaw.model === "string" ? metricsRaw.model.slice(0, 120) : "",
      dimensions:
        typeof metricsRaw.dimensions === "number" ? metricsRaw.dimensions : 0
    }
  };
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
    if (key === "knowledge") {
      const sanitized = sanitizeKnowledgeMeta(value);
      if (sanitized) out.knowledge = sanitized;
      continue;
    }
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
