import crypto from "crypto";
import {
  AI_ANALYTICS_PREVIEW_MAX_CHARS,
  AI_ANALYTICS_REPLAY_CONTEXT_MAX_CHARS,
  AI_ANALYTICS_REPLAY_PROMPT_MAX_CHARS
} from "../../../config/aiAgentAnalyticsConstants";

/** Dia UTC no formato YYYY-MM-DD. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function previewText(
  s: unknown,
  max: number = AI_ANALYTICS_PREVIEW_MAX_CHARS
): string {
  const text = String(s ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max);
}

export function hashQuestion(s: unknown): string {
  const normalized = String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 64);
}

export function bumpCounterMap(
  map: Record<string, number> | null | undefined,
  key: string
): Record<string, number> {
  const next: Record<string, number> = { ...(map || {}) };
  const k = String(key || "").trim() || "unknown";
  next[k] = Number(next[k] || 0) + 1;
  return next;
}

export function avg(sum: number, count: number): number | null {
  if (!count || count <= 0 || !Number.isFinite(sum)) return null;
  return sum / count;
}

const SENSITIVE_KEY_RE =
  /(apikey|api_key|password|secret|token|authorization|bearer|embedding|embeddings|storagepath|storage_path|privatekey|private_key)/i;

function truncateString(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (depth > 8) return null;
  if (SENSITIVE_KEY_RE.test(key)) return undefined;

  if (value == null) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;

  if (typeof value === "string") {
    const lower = key.toLowerCase();
    if (lower.includes("prompt")) {
      return truncateString(value, AI_ANALYTICS_REPLAY_PROMPT_MAX_CHARS);
    }
    if (lower.includes("context")) {
      return truncateString(value, AI_ANALYTICS_REPLAY_CONTEXT_MAX_CHARS);
    }
    return truncateString(value, AI_ANALYTICS_REPLAY_PROMPT_MAX_CHARS);
  }

  if (Array.isArray(value)) {
    if (/embedding/i.test(key)) return undefined;
    return value.slice(0, 50).map((item, idx) =>
      sanitizeValue(String(idx), item, depth + 1)
    );
  }

  if (typeof value === "object") {
    return sanitizeReplaySnapshot(value as Record<string, unknown>, depth + 1);
  }

  return null;
}

/**
 * Remove segredos/embeddings/paths e trunca prompt/contexto do snapshot de replay.
 */
export function sanitizeReplaySnapshot(
  raw: unknown,
  depth = 0
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(key)) continue;
    const sanitized = sanitizeValue(key, value, depth);
    if (sanitized !== undefined) {
      out[key] = sanitized;
    }
  }
  return out;
}
