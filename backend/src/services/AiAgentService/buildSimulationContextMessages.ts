import { ChatCompletionRequestMessage } from "openai";
import {
  AI_AGENT_SIMULATOR_CONTEXT_MAX_CHARS,
  AI_AGENT_SIMULATOR_CONTEXT_MAX_MESSAGES
} from "./aiAgentSimulatorConfig";

type SimulationMessageRow = {
  role: string;
  content: string;
};

export function buildSimulationContextMessages(
  rows: SimulationMessageRow[]
): ChatCompletionRequestMessage[] {
  const conversational = rows.filter(
    (row) => row.role === "user" || row.role === "assistant"
  );

  const selected = conversational.slice(-AI_AGENT_SIMULATOR_CONTEXT_MAX_MESSAGES);
  const trimmed: SimulationMessageRow[] = [];
  let totalChars = 0;

  for (let i = selected.length - 1; i >= 0; i -= 1) {
    const content = String(selected[i].content || "");
    if (
      totalChars + content.length > AI_AGENT_SIMULATOR_CONTEXT_MAX_CHARS &&
      trimmed.length > 0
    ) {
      break;
    }
    trimmed.unshift(selected[i]);
    totalChars += content.length;
  }

  return trimmed
    .map((row) => ({
      role: row.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: String(row.content || "").trim()
    }))
    .filter((message) => message.content);
}
