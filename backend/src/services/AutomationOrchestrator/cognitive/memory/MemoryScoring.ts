import { MemoryType } from "../../../../config/automationCognitiveMemoryConstants";
import { getCognitiveMemoryConfig } from "./CognitiveMemoryConfig";
import { KnowledgeObject, ScoredMemory } from "./memoryTypes";

const frequencyByKey = new Map<string, number>();

function freqKey(tenantId: number, id: string): string {
  return `${tenantId}:${id}`;
}

export function recordMemoryAccess(tenantId: number, id: string): void {
  const key = freqKey(tenantId, id);
  frequencyByKey.set(key, (frequencyByKey.get(key) || 0) + 1);
}

export function getMemoryFrequency(tenantId: number, id: string): number {
  return frequencyByKey.get(freqKey(tenantId, id)) || 0;
}

/**
 * Memory Scoring — determinístico (sem IA).
 * Score = recência + importância + confiança + frequência + tipo
 */
export function scoreMemoryObject(input: {
  tenantId: number;
  object: KnowledgeObject;
  nowMs?: number;
}): ScoredMemory {
  const cfg = getCognitiveMemoryConfig(input.tenantId).scoring;
  const now = input.nowMs ?? Date.now();
  const ageMs = Math.max(0, now - Date.parse(input.object.updatedAt || input.object.createdAt));
  const dayMs = 86_400_000;
  const recency = Math.max(0, 1 - ageMs / (30 * dayMs));

  const importance = Math.max(0, Math.min(1, input.object.importance));
  const confidence = Math.max(0, Math.min(1, input.object.confidence));
  const freqRaw = getMemoryFrequency(input.tenantId, input.object.id);
  const frequency = Math.min(1, freqRaw / 10);
  const type =
    cfg.typeBoost[input.object.memoryType as MemoryType] ?? 0.5;

  const score =
    recency * cfg.weightRecency +
    importance * cfg.weightImportance +
    confidence * cfg.weightConfidence +
    frequency * cfg.weightFrequency +
    type * cfg.weightType;

  return {
    object: input.object,
    score: Number(score.toFixed(4)),
    scoreBreakdown: {
      recency: Number(recency.toFixed(4)),
      importance: Number(importance.toFixed(4)),
      confidence: Number(confidence.toFixed(4)),
      frequency: Number(frequency.toFixed(4)),
      type: Number(type.toFixed(4))
    }
  };
}

export function scoreAndSort(input: {
  tenantId: number;
  objects: KnowledgeObject[];
}): ScoredMemory[] {
  return input.objects
    .map(object => scoreMemoryObject({ tenantId: input.tenantId, object }))
    .sort((a, b) => b.score - a.score);
}

export function __resetMemoryScoringForTests(): void {
  frequencyByKey.clear();
}

export default { scoreMemoryObject, scoreAndSort };
