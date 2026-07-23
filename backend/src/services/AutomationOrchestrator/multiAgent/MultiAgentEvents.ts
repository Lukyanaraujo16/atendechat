import { createHash } from "crypto";
import { MultiAgentEventName } from "../../../config/automationMultiAgentConstants";
import { MultiAgentEvent } from "./types";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";

const events: MultiAgentEvent[] = [];

export function emitMultiAgentEvent(
  companyId: number,
  name: MultiAgentEventName,
  subjectId: string | null = null,
  payload: Record<string, unknown> = {}
): MultiAgentEvent {
  const event: MultiAgentEvent = {
    id: `maevt_${createHash("sha256")
      .update(`${companyId}:${name}:${Date.now()}:${Math.random()}`)
      .digest("hex")
      .slice(0, 12)}`,
    companyId,
    name,
    subjectId,
    at: new Date().toISOString(),
    payload
  };
  events.unshift(event);
  if (events.length > 3000) events.length = 3000;
  observabilityRepository.writeEventFireAndForget({
    companyId,
    moduleKey: "multiAgent",
    eventName: name,
    entityId: subjectId,
    payload
  });
  return event;
}

export function listMultiAgentEvents(
  companyId: number,
  limit = 50
): MultiAgentEvent[] {
  return events.filter(e => e.companyId === companyId).slice(0, limit);
}

export function __resetMultiAgentEventsForTests(): void {
  events.length = 0;
}

export default { emitMultiAgentEvent, listMultiAgentEvents };
