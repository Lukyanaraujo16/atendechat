import { MemoryEvent } from "./memoryTypes";

export type CognitiveMemoryMetricsSnapshot = {
  objectsCreated: number;
  objectsUpdated: number;
  retrievals: number;
  averageScore: number;
  memoryByType: Record<string, number>;
  knowledgeGrowth: number;
};

const state = {
  objectsCreated: 0,
  objectsUpdated: 0,
  retrievals: 0,
  scoreSum: 0,
  scoreCount: 0,
  memoryByType: {} as Record<string, number>,
  knowledgeGrowth: 0
};

const events: MemoryEvent[] = [];
const MAX_EVENTS = 500;

export function recordMemoryMutation(
  kind: "created" | "updated" | "deleted" | "retrieval",
  memoryType?: string
): void {
  if (kind === "created") {
    state.objectsCreated += 1;
    state.knowledgeGrowth += 1;
    if (memoryType) {
      state.memoryByType[memoryType] =
        (state.memoryByType[memoryType] || 0) + 1;
    }
  } else if (kind === "updated") {
    state.objectsUpdated += 1;
  } else if (kind === "deleted") {
    state.knowledgeGrowth = Math.max(0, state.knowledgeGrowth - 1);
  } else if (kind === "retrieval") {
    state.retrievals += 1;
  }
}

export function recordRetrievalScores(scores: number[]): void {
  for (const s of scores) {
    state.scoreSum += s;
    state.scoreCount += 1;
  }
}

export function recordMemoryEvent(event: MemoryEvent): void {
  events.push(event);
  if (events.length > MAX_EVENTS) events.shift();
}

export function getCognitiveMemoryMetrics(): CognitiveMemoryMetricsSnapshot {
  return {
    objectsCreated: state.objectsCreated,
    objectsUpdated: state.objectsUpdated,
    retrievals: state.retrievals,
    averageScore:
      state.scoreCount > 0 ? state.scoreSum / state.scoreCount : 0,
    memoryByType: { ...state.memoryByType },
    knowledgeGrowth: state.knowledgeGrowth
  };
}

export function listMemoryEvents(limit = 50): MemoryEvent[] {
  return events.slice(-limit).reverse();
}

export function __resetCognitiveMemoryMetricsForTests(): void {
  state.objectsCreated = 0;
  state.objectsUpdated = 0;
  state.retrievals = 0;
  state.scoreSum = 0;
  state.scoreCount = 0;
  state.memoryByType = {};
  state.knowledgeGrowth = 0;
  events.length = 0;
}

export default {
  getCognitiveMemoryMetrics,
  listMemoryEvents
};
