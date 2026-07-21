import { logger } from "../../../utils/logger";
import { sanitizeToolSnapshot } from "./sanitizeToolSnapshot";
import { AutomationToolEventName } from "../../../config/automationToolConstants";

export type EmitToolEventInput = {
  companyId: number;
  eventName: AutomationToolEventName | string;
  toolId?: string;
  toolVersion?: string;
  automationExecutionId?: number | null;
  toolExecutionId?: number | string | null;
  payload?: Record<string, unknown> | null;
};

type ToolEventListener = (event: EmitToolEventInput & { at: string }) => void;

const listeners: ToolEventListener[] = [];
const recentEvents: Array<EmitToolEventInput & { at: string }> = [];
const MAX_RECENT = 200;

/**
 * Event bus interno de Tools.
 * Não integra webhook externo nesta fase.
 * Persistência em AutomationExecutionEvent quando há automationExecutionId.
 */
export async function emitToolEvent(
  input: EmitToolEventInput
): Promise<void> {
  const event = {
    ...input,
    payload: sanitizeToolSnapshot(input.payload || {}),
    at: new Date().toISOString()
  };

  recentEvents.push(event);
  if (recentEvents.length > MAX_RECENT) recentEvents.shift();

  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // fail-open
    }
  }

  if (input.automationExecutionId) {
    try {
      const { emitAutomationEvent } = await import("../EventBus");
      await emitAutomationEvent({
        companyId: input.companyId,
        executionId: input.automationExecutionId,
        eventName: input.eventName,
        payload: {
          toolId: input.toolId,
          toolVersion: input.toolVersion,
          toolExecutionId: input.toolExecutionId,
          ...(event.payload || {})
        }
      });
    } catch (err) {
      logger.warn(
        { err, companyId: input.companyId, eventName: input.eventName },
        "[AutomationTools] emitToolEvent persist fail-open"
      );
    }
  }
}

export function onToolEvent(listener: ToolEventListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getRecentToolEvents(companyId?: number): Array<
  EmitToolEventInput & { at: string }
> {
  if (companyId == null) return [...recentEvents];
  return recentEvents.filter(e => e.companyId === companyId);
}

export function __resetToolEventsForTests(): void {
  recentEvents.length = 0;
  listeners.length = 0;
}

export default emitToolEvent;
