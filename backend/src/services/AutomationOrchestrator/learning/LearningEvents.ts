import { createHash } from "crypto";
import { LearningEventName } from "../../../config/automationLearningConstants";
import { LearningEvent } from "./types";

const events: LearningEvent[] = [];

export function emitLearningEvent(
  companyId: number,
  name: LearningEventName,
  subjectId: string | null = null,
  payload: Record<string, unknown> = {}
): LearningEvent {
  const event: LearningEvent = {
    id: `levt_${createHash("sha256")
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
  if (events.length > 2000) events.length = 2000;
  return event;
}

export function listLearningEvents(
  companyId: number,
  limit = 50
): LearningEvent[] {
  return events.filter(e => e.companyId === companyId).slice(0, limit);
}

export function __resetLearningEventsForTests(): void {
  events.length = 0;
}

export default { emitLearningEvent, listLearningEvents };
