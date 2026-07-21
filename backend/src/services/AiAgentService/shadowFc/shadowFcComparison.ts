import {
  SHADOW_FC_USD_PER_TOKEN
} from "../../../config/automationShadowFcConstants";

export function buildObjectiveComparison(input: {
  officialReply: string;
  shadowReply: string;
  officialLatencyMs?: number | null;
  shadowLatencyMs?: number | null;
  officialTokens?: number | null;
  shadowTokens?: number | null;
  usedTools: boolean;
  usedKnowledgeOfficial?: boolean;
  usedKnowledgeShadow?: boolean;
  toolCallCount: number;
}): Record<string, unknown> {
  const a = String(input.officialReply || "");
  const b = String(input.shadowReply || "");
  const aWords = tokenize(a);
  const bWords = tokenize(b);
  const overlap = jaccard(aWords, bWords);
  const exactMatch = a.trim() === b.trim();
  const lenA = a.length;
  const lenB = b.length;
  const lengthDelta = lenB - lenA;
  const lengthRatio = lenA === 0 ? (lenB === 0 ? 1 : 0) : lenB / lenA;

  return {
    textual: {
      exactMatch,
      lengthOfficial: lenA,
      lengthShadow: lenB,
      lengthDelta,
      lengthRatio: Number(lengthRatio.toFixed(4)),
      wordCountOfficial: aWords.size,
      wordCountShadow: bWords.size,
      jaccardOverlap: Number(overlap.toFixed(4)),
      commonPrefixLen: commonPrefixLength(a, b)
    },
    structural: {
      sentenceCountOfficial: countSentences(a),
      sentenceCountShadow: countSentences(b),
      shadowLonger: lenB > lenA,
      shadowShorter: lenB < lenA
    },
    tools: {
      usedTools: input.usedTools,
      toolCallCount: input.toolCallCount
    },
    knowledge: {
      official: input.usedKnowledgeOfficial === true,
      shadow: input.usedKnowledgeShadow === true
    },
    timing: {
      officialLatencyMs: input.officialLatencyMs ?? null,
      shadowLatencyMs: input.shadowLatencyMs ?? null,
      latencyDeltaMs:
        input.shadowLatencyMs != null && input.officialLatencyMs != null
          ? input.shadowLatencyMs - input.officialLatencyMs
          : null
    },
    tokens: {
      official: input.officialTokens ?? null,
      shadow: input.shadowTokens ?? null,
      tokenDelta:
        input.shadowTokens != null && input.officialTokens != null
          ? input.shadowTokens - input.officialTokens
          : null
    },
    cost: {
      officialUsd: estimateCostUsd(input.officialTokens),
      shadowUsd: estimateCostUsd(input.shadowTokens)
    }
  };
}

export function estimateCostUsd(tokens?: number | null): number | null {
  if (tokens == null || !Number.isFinite(tokens)) return null;
  return Number((Math.max(0, tokens) * SHADOW_FC_USD_PER_TOKEN).toFixed(6));
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

function countSentences(text: string): number {
  const parts = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  return parts.length;
}

export default { buildObjectiveComparison, estimateCostUsd };
