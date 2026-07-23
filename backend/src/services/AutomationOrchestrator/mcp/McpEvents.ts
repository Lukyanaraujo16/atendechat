import { createHash } from "crypto";
import { McpEventName } from "../../../config/automationMcpConstants";
import { McpEvent } from "./types";

const events: McpEvent[] = [];
const MAX = 500;

export function emitMcpEvent(
  companyId: number,
  name: McpEventName | string,
  message?: string,
  metaOrCode?: string | Record<string, unknown>
): McpEvent {
  const meta =
    typeof metaOrCode === "string"
      ? { code: metaOrCode }
      : metaOrCode || undefined;
  const event: McpEvent = {
    id: `mcpevt_${createHash("sha256")
      .update(`${companyId}:${name}:${Date.now()}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId,
    name,
    at: new Date().toISOString(),
    message,
    meta
  };
  events.push(event);
  if (events.length > MAX) events.shift();
  return event;
}

export function listMcpEvents(companyId: number, limit = 50): McpEvent[] {
  return events
    .filter(e => e.companyId === companyId)
    .slice(-limit)
    .reverse();
}

export function __resetMcpEventsForTests(): void {
  events.length = 0;
}

export default { emitMcpEvent, listMcpEvents };
