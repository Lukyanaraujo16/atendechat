const SENSITIVE_KEY_PATTERN =
  /(apikey|api_key|apiKey|embeddings?|storagePath|storage_path|password|secret|token|privateKey|private_key)/i;

const PHONE_KEY_PATTERN = /(phone|number|whatsapp|msisdn)/i;

const MAX_STRING = 200;

function maskPhoneLike(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 8) {
    return value.slice(0, MAX_STRING);
  }
  const last4 = digits.slice(-4);
  return `***${last4}`;
}

function sanitizeValue(key: string, value: unknown, depth: number): unknown {
  if (depth > 8) return undefined;
  if (SENSITIVE_KEY_PATTERN.test(key)) return undefined;

  if (value == null) return value;
  if (typeof value === "boolean" || typeof value === "number") return value;

  if (typeof value === "string") {
    if (PHONE_KEY_PATTERN.test(key)) {
      return maskPhoneLike(value);
    }
    return value.length > MAX_STRING ? value.slice(0, MAX_STRING) : value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 50)
      .map((item, i) => sanitizeValue(String(i), item, depth + 1))
      .filter(v => v !== undefined);
  }

  if (typeof value === "object") {
    return sanitizeAutomationPayload(value as Record<string, unknown>, depth + 1);
  }

  return undefined;
}

/**
 * Remove chaves sensíveis e trunca strings (máx. 200).
 */
export function sanitizeAutomationPayload(
  payload: Record<string, unknown> | null | undefined,
  depth = 0
): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) continue;
    const sanitized = sanitizeValue(key, value, depth);
    if (sanitized !== undefined) {
      out[key] = sanitized;
    }
  }
  return out;
}

export default sanitizeAutomationPayload;
