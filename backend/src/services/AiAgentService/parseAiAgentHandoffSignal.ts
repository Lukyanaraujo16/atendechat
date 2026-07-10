export const AI_AGENT_HANDOFF_MARKER = "[HANDOFF_HUMAN]";

const HANDOFF_LINE_PATTERN = /^\s*\[HANDOFF_HUMAN\]\s*$/i;
const HANDOFF_TRAILING_PATTERN = /\n?\s*\[HANDOFF_HUMAN\]\s*$/i;

export type ParsedAiAgentHandoffSignal = {
  cleanText: string;
  handoffRequested: boolean;
  handoffReason: string | null;
};

export function parseAiAgentHandoffSignal(
  responseText: string | null | undefined
): ParsedAiAgentHandoffSignal {
  const raw = String(responseText ?? "");
  const lines = raw.split(/\r?\n/);
  let markerFound = false;

  const keptLines = lines.filter((line) => {
    if (HANDOFF_LINE_PATTERN.test(line)) {
      markerFound = true;
      return false;
    }
    return true;
  });

  let cleanText = keptLines.join("\n").trim();
  if (HANDOFF_TRAILING_PATTERN.test(cleanText)) {
    markerFound = true;
    cleanText = cleanText.replace(HANDOFF_TRAILING_PATTERN, "").trim();
  }

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
