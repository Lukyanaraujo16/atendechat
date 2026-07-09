import { AI_AGENT_LIVE_MAX_RESPONSE_CHARS } from "./aiAgentLiveConfig";
import { AI_AGENT_LIVE_ERROR_CODES } from "./aiAgentLiveErrors";
import { AI_AGENT_SHADOW_ERROR_CODES } from "./aiAgentShadowErrors";

const INTERNAL_MARKERS = [
  /^\s*\{/,
  /"error"\s*:/i,
  /internal error/i,
  /system prompt/i,
  /não posso ajudar com isso/i
];

export type ValidateAiAgentLiveResponseResult =
  | { ok: true; text: string }
  | { ok: false; errorCode: string };

export function validateAiAgentLiveResponse(
  raw: string | null | undefined
): ValidateAiAgentLiveResponseResult {
  const text = String(raw ?? "").trim();
  if (!text) {
    return { ok: false, errorCode: AI_AGENT_SHADOW_ERROR_CODES.EMPTY_AI_RESPONSE };
  }

  if (text.length > AI_AGENT_LIVE_MAX_RESPONSE_CHARS) {
    return {
      ok: false,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_RESPONSE_TOO_LONG
    };
  }

  for (const pattern of INTERNAL_MARKERS) {
    if (pattern.test(text)) {
      return {
        ok: false,
        errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_RESPONSE_INVALID
      };
    }
  }

  return { ok: true, text };
}
