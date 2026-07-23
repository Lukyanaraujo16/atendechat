import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";
import { getTimeline, getTimelinePersistent, listTimelines } from "./TimelineBuilder";
import { listAgentOsEvents } from "./AgentOsEventBus";
import { sanitizeAutomationPayload } from "../sanitizeAutomationPayload";
import { AGENTOS_OBSERVABILITY_MODULE_KEY } from "../../../config/automationAgentOsObservabilityConstants";

/**
 * Replay administrativo 100% a partir de dados persistidos (+ memória como cache opcional).
 * Sem dependência exclusiva de cache.
 */
export async function rebuildExecutionFromPersistence(input: {
  companyId: number;
  traceId: string;
}) {
  const timeline =
    (await getTimelinePersistent(input.companyId, input.traceId)) ||
    getTimeline(input.traceId);

  const events = listAgentOsEvents(input.companyId, {
    traceId: input.traceId,
    limit: 500
  });

  const audits = await observabilityRepository.listAudits(input.companyId, {
    limit: 200
  });
  const auditsForTrace = (audits || [])
    .map((a: any) => (typeof a.toJSON === "function" ? a.toJSON() : a))
    .filter((a: any) => a?.payloadSanitized?.traceId === input.traceId);

  const replayRow = await observabilityRepository.getReplay(
    input.companyId,
    `exec_${input.traceId}`
  );

  const rebuilt = {
    traceId: input.traceId,
    companyId: input.companyId,
    source: replayRow ? "persistent_replay" : timeline ? "timeline" : "partial",
    timeline,
    events,
    audits: auditsForTrace,
    replayPayload: replayRow?.payload
      ? sanitizeAutomationPayload(replayRow.payload as any)
      : null,
    reconstructedAt: new Date().toISOString(),
    complete: Boolean(timeline && timeline.steps.length > 0)
  };

  await observabilityRepository.saveReplay({
    id: `exec_${input.traceId}`,
    companyId: input.companyId,
    moduleKey: AGENTOS_OBSERVABILITY_MODULE_KEY,
    sourceId: input.traceId,
    sessionId: timeline?.sessionId ?? null,
    agentId: timeline?.agentId ?? null,
    payload: sanitizeAutomationPayload(rebuilt as any)
  });

  return rebuilt;
}

export async function reprocessReplay(input: {
  companyId: number;
  traceId: string;
}) {
  return rebuildExecutionFromPersistence(input);
}

export function listInMemoryTimelines(companyId: number) {
  return listTimelines(companyId);
}
