/** Marcador canônico ensinado no system prompt. */
export const AI_AGENT_HANDOFF_MARKER = "[HANDOFF_HUMAN]";

/**
 * Identificadores conhecidos (sem colchetes).
 * Canônico + único alias observado em produção. Sem traduções especulativas.
 */
export const AI_AGENT_HANDOFF_MARKER_IDS = [
  "HANDOFF_HUMAN",
  "FIM_HUMANO"
] as const;

const HANDOFF_MARKER_ID_ALT = AI_AGENT_HANDOFF_MARKER_IDS.join("|");

/**
 * Token conhecido: markdown simples opcional + [id] com espaços internos.
 * Não casa colchetes genéricos ([EXEMPLO], [INAUDIVEL], etc.).
 */
const HANDOFF_MARKER_SOURCE = `(?:\\*{1,3}\\s*)?\\[\\s*(?:${HANDOFF_MARKER_ID_ALT})\\s*\\](?:\\s*\\*{1,3})?`;

export function createAiAgentHandoffMarkerPattern(): RegExp {
  return new RegExp(HANDOFF_MARKER_SOURCE, "gi");
}

export type ParsedAiAgentHandoffSignal = {
  cleanText: string;
  handoffRequested: boolean;
  handoffReason: string | null;
};

export function containsKnownAiAgentHandoffMarker(
  text: string | null | undefined
): boolean {
  const raw = String(text ?? "");
  if (!raw) return false;
  return createAiAgentHandoffMarkerPattern().test(raw);
}

function normalizeResidualWhitespace(text: string): string {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Sanitização: remove só tokens de handoff conhecidos. Sem decisão semântica. */
export function stripKnownAiAgentHandoffMarkers(
  text: string | null | undefined
): string {
  const raw = String(text ?? "");
  if (!raw) return "";
  const stripped = raw.replace(createAiAgentHandoffMarkerPattern(), "");
  return normalizeResidualWhitespace(stripped);
}

export function parseAiAgentHandoffSignal(
  responseText: string | null | undefined
): ParsedAiAgentHandoffSignal {
  const raw = String(responseText ?? "");
  const markerFound = containsKnownAiAgentHandoffMarker(raw);
  const cleanText = stripKnownAiAgentHandoffMarkers(raw);

  return {
    cleanText,
    handoffRequested: markerFound,
    handoffReason: markerFound ? "model_requested_handoff" : null
  };
}

export function sanitizeAiAgentLiveResponseText(
  responseText: string | null | undefined
): ParsedAiAgentHandoffSignal {
  return parseAiAgentHandoffSignal(responseText);
}
