import { ToolInternalResult, ToolModelResult } from "./contracts/ToolResultTypes";
import { ToolResult } from "./contracts/ToolContract";

const INTERNAL_KEYS = new Set([
  "companyId",
  "company_id",
  "internalId",
  "internal_id",
  "createdAt",
  "updatedAt",
  "deletedAt",
  "startedAt",
  "finishedAt",
  "durationMs",
  "metrics",
  "logs",
  "audit",
  "debug",
  "embedding",
  "embeddings",
  "vector",
  "storagePath",
  "apiKey",
  "token",
  "password",
  "secret",
  "correlationId",
  "requestId",
  "idempotencyKey",
  "executionId",
  "sideEffectCommitted",
  "rollbackAvailable",
  "confirmationStatus",
  "cacheHit",
  "cacheMiss",
  "emptyResult",
  "resultCount"
]);

const ID_KEYS = new Set([
  "id",
  "userId",
  "contactId",
  "ticketId",
  "queueId",
  "tagId",
  "whatsappId",
  "aiAgentId",
  "documentId",
  "chunkId",
  "knowledgeBaseId",
  "automationExecutionId",
  "messageId"
]);

function stripValue(value: unknown, depth: number): unknown {
  if (depth > 6) return undefined;
  if (value == null) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") {
    return value.length > 500 ? value.slice(0, 500) : value;
  }
  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map(v => stripValue(v, depth + 1))
      .filter(v => v !== undefined);
  }
  if (typeof value === "object") {
    return stripObject(value as Record<string, unknown>, depth + 1);
  }
  return undefined;
}

function stripObject(
  obj: Record<string, unknown>,
  depth: number
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (INTERNAL_KEYS.has(key)) continue;
    if (ID_KEYS.has(key)) continue;
    if (/Id$|_id$/i.test(key) && typeof value === "number") continue;
    const cleaned = stripValue(value, depth);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

/**
 * Adaptador explícito Internal → Model.
 * Único caminho permitido para expor dados ao modelo.
 * Não permite bypass.
 */
export function toModelResult(
  internal: ToolInternalResult | ToolResult,
  toolId: string
): ToolModelResult {
  if (
    internal.status === "denied" ||
    internal.status === "skipped" ||
    internal.status === "waiting_confirmation"
  ) {
    return {
      status: internal.status === "waiting_confirmation" ? "denied" : (internal.status as "denied" | "skipped"),
      tool: toolId,
      summary: internal.errors?.[0]?.message || internal.status
    };
  }

  if (internal.status === "failure" || internal.status === "retry") {
    return {
      status: "failure",
      tool: toolId,
      summary: internal.errors?.[0]?.message || "failure",
      warnings: (internal.warnings || []).slice(0, 3)
    };
  }

  const payload =
    (internal as ToolInternalResult).modelPayload ||
    internal.displayData ||
    internal.data ||
    {};

  const resultCount =
    typeof (internal.metrics as { resultCount?: number })?.resultCount ===
    "number"
      ? (internal.metrics as { resultCount?: number }).resultCount
      : Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items.length
        : undefined;

  const empty =
    (internal.metrics as { emptyResult?: boolean })?.emptyResult === true ||
    resultCount === 0;

  if (empty) {
    return {
      status: "empty",
      tool: toolId,
      summary: "no_results",
      items: [],
      count: 0,
      hasMore: false
    };
  }

  const itemsRaw = (payload as { items?: Array<Record<string, unknown>> }).items;
  const itemRaw = (payload as { item?: Record<string, unknown> }).item;

  const model: ToolModelResult = {
    status: "success",
    tool: toolId,
    summary:
      typeof (payload as { summary?: string }).summary === "string"
        ? String((payload as { summary?: string }).summary).slice(0, 300)
        : undefined
  };

  if (Array.isArray(itemsRaw)) {
    model.items = itemsRaw
      .slice(0, 50)
      .map(i => stripObject(i || {}, 0));
    model.count =
      typeof (payload as { count?: number }).count === "number"
        ? Number((payload as { count?: number }).count)
        : model.items.length;
    model.hasMore = (payload as { hasMore?: boolean }).hasMore === true;
  } else if (itemRaw && typeof itemRaw === "object") {
    model.item = stripObject(itemRaw, 0);
  } else {
    model.item = stripObject(payload as Record<string, unknown>, 0);
  }

  if (Array.isArray(internal.warnings) && internal.warnings.length) {
    model.warnings = internal.warnings.slice(0, 3).map(w => String(w).slice(0, 200));
  }

  return model;
}

/**
 * Diff sanitizado Internal vs Model para Replay/Tester.
 */
export function diffInternalVsModel(
  internal: ToolInternalResult | ToolResult,
  model: ToolModelResult
): Record<string, unknown> {
  const internalKeys = Object.keys(
    (internal as ToolInternalResult).modelPayload ||
      internal.displayData ||
      internal.data ||
      {}
  );
  const modelKeys = new Set<string>();
  const collect = (obj: unknown, prefix = ""): void => {
    if (!obj || typeof obj !== "object") return;
    for (const k of Object.keys(obj as object)) {
      modelKeys.add(prefix ? `${prefix}.${k}` : k);
    }
  };
  collect(model.item);
  if (model.items?.[0]) collect(model.items[0], "items[]");

  return {
    hiddenFromModel: [
      "companyId",
      "metrics",
      "logs",
      "audit",
      "ids",
      "timestamps",
      "embeddings"
    ],
    internalTopLevelKeys: internalKeys.slice(0, 40),
    modelTopLevelKeys: Array.from(modelKeys).slice(0, 40),
    modelStatus: model.status,
    internalStatus: internal.status,
    resultCount: (internal.metrics as { resultCount?: number })?.resultCount ?? null
  };
}

export default toModelResult;
