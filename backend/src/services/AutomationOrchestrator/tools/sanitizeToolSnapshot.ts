import { sanitizeAutomationPayload } from "../sanitizeAutomationPayload";

const EXTRA_SENSITIVE =
  /(authorization|bearer|cookie|credential|prompt|embedding|binary|fileContent|base64)/i;

/**
 * Sanitização de snapshots de Tool para auditoria/replay.
 * Reutiliza sanitizer do Orchestrator + chaves extras.
 */
export function sanitizeToolSnapshot(
  payload: Record<string, unknown> | null | undefined,
  maxBytes = 8 * 1024
): Record<string, unknown> {
  const base = sanitizeAutomationPayload(payload || {});
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(base)) {
    if (EXTRA_SENSITIVE.test(key)) continue;
    cleaned[key] = value;
  }

  let json = JSON.stringify(cleaned);
  if (json.length > maxBytes) {
    return {
      _truncated: true,
      _originalBytes: json.length,
      preview: json.slice(0, Math.max(0, maxBytes - 80))
    };
  }
  return cleaned;
}

export default sanitizeToolSnapshot;
