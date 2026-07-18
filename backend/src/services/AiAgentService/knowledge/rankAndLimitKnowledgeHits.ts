import type { KnowledgeRetrievalHit } from "./knowledgeRetrievalTypes";

function normalizeContent(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function overlapRatio(a: string, b: string): number {
  if (!a || !b) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (longer.includes(shorter) && shorter.length > 40) {
    return shorter.length / longer.length;
  }
  // token Jaccard simples
  const ta = new Set(shorter.split(" ").filter(t => t.length > 2));
  const tb = new Set(longer.split(" ").filter(t => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  ta.forEach(t => {
    if (tb.has(t)) inter += 1;
  });
  return inter / (ta.size + tb.size - inter);
}

/**
 * Ordena por similaridade e prioridade de vínculo; aplica limites e dedupe.
 */
export function rankAndLimitKnowledgeHits(input: {
  hits: KnowledgeRetrievalHit[];
  topK: number;
  maxChunksPerDocument: number;
  maxChunksPerBase: number;
}): KnowledgeRetrievalHit[] {
  const sorted = [...input.hits].sort((a, b) => {
    if (b.similarityScore !== a.similarityScore) {
      return b.similarityScore - a.similarityScore;
    }
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.chunkId - b.chunkId;
  });

  const perDoc = new Map<number, number>();
  const perBase = new Map<number, number>();
  const seenHashes = new Set<string>();
  const accepted: KnowledgeRetrievalHit[] = [];
  const maxPerDoc = Math.max(1, input.maxChunksPerDocument);
  const maxPerBase = Math.max(1, input.maxChunksPerBase);
  const topK = Math.max(1, input.topK);

  for (const hit of sorted) {
    if (accepted.length >= topK) break;

    const hashKey = hit.chunkHash || normalizeContent(hit.content).slice(0, 200);
    if (hashKey && seenHashes.has(hashKey)) continue;

    const docCount = perDoc.get(hit.documentId) || 0;
    if (docCount >= maxPerDoc) continue;
    const baseCount = perBase.get(hit.knowledgeBaseId) || 0;
    if (baseCount >= maxPerBase) continue;

    const norm = normalizeContent(hit.content);
    const nearDup = accepted.some(
      a =>
        (a.documentId === hit.documentId &&
          overlapRatio(normalizeContent(a.content), norm) >= 0.85) ||
        overlapRatio(normalizeContent(a.content), norm) >= 0.92
    );
    if (nearDup) continue;

    accepted.push(hit);
    perDoc.set(hit.documentId, docCount + 1);
    perBase.set(hit.knowledgeBaseId, baseCount + 1);
    if (hashKey) seenHashes.add(hashKey);
  }

  return accepted;
}
