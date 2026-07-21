import {
  EvidenceFinding,
  ShadowEvaluationEvidenceInput,
  normalizeForMatch,
  valueAppearsInReply
} from "./evidenceTypes";

type KnowledgeChunk = {
  id?: string;
  text?: string;
  content?: string;
  score?: number;
};

/**
 * Avaliação objetiva de Knowledge/RAG vs resposta.
 */
export function evaluateKnowledgeEvidence(
  evaluation: ShadowEvaluationEvidenceInput
): EvidenceFinding[] {
  const findings: EvidenceFinding[] = [];
  const reply = String(evaluation.shadowReply || "");
  const meta = evaluation.knowledgeMeta || {};
  const knowledge = (meta as any).knowledge || meta;
  const chunks: KnowledgeChunk[] = Array.isArray(knowledge?.chunks)
    ? knowledge.chunks
    : Array.isArray(knowledge?.retrievedChunks)
      ? knowledge.retrievedChunks
      : Array.isArray((meta as any).chunks)
        ? (meta as any).chunks
        : [];

  if (!chunks.length) {
    return findings;
  }

  const usedIds: string[] = [];
  const unusedIds: string[] = [];
  const usedTexts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const id = String(c.id || `chunk-${i}`);
    const text = String(c.text || c.content || "").trim();
    if (!text) {
      unusedIds.push(id);
      continue;
    }
    // Uso: overlap de tokens significativos (>= 4 chars) ≥ 2 OU substring de 24+ chars
    if (chunkUsedInReply(text, reply)) {
      usedIds.push(id);
      usedTexts.push(text.slice(0, 200));
    } else {
      unusedIds.push(id);
    }
  }

  if (usedIds.length > 0) {
    findings.push({
      type: "KNOWLEDGE_VERIFIED",
      justification: `${usedIds.length}/${chunks.length} trecho(s) de knowledge refletidos na resposta.`,
      facts: {
        knowledgeChunkIds: chunks.map((c, i) => String(c.id || `chunk-${i}`)),
        usedChunkIds: usedIds,
        unusedChunkIds: unusedIds
      }
    });
  }

  if (unusedIds.length > 0 && usedIds.length === 0) {
    findings.push({
      type: "KNOWLEDGE_UNUSED",
      justification: "Knowledge recuperada, mas nenhum trecho refletido na resposta.",
      facts: {
        knowledgeChunkIds: chunks.map((c, i) => String(c.id || `chunk-${i}`)),
        usedChunkIds: [],
        unusedChunkIds: unusedIds
      }
    });
  } else if (unusedIds.length > 0 && usedIds.length > 0) {
    findings.push({
      type: "KNOWLEDGE_UNUSED",
      justification: `${unusedIds.length} trecho(s) recuperados e ignorados.`,
      facts: {
        knowledgeChunkIds: chunks.map((c, i) => String(c.id || `chunk-${i}`)),
        usedChunkIds: usedIds,
        unusedChunkIds: unusedIds
      }
    });
  }

  return findings;
}

function chunkUsedInReply(chunkText: string, reply: string): boolean {
  const c = normalizeForMatch(chunkText);
  const r = normalizeForMatch(reply);
  if (!c || !r) return false;

  // Substring longa
  for (let len = 40; len >= 24; len -= 4) {
    if (c.length < len) continue;
    for (let i = 0; i <= c.length - len; i += Math.max(8, Math.floor(len / 2))) {
      const slice = c.slice(i, i + len);
      if (r.includes(slice)) return true;
    }
  }

  const tokens = c
    .split(/\s+/)
    .filter(t => t.length >= 4)
    .slice(0, 40);
  let hits = 0;
  for (const t of tokens) {
    if (r.includes(t)) hits += 1;
  }
  return hits >= 2;
}

export { chunkUsedInReply, valueAppearsInReply };
export default { evaluateKnowledgeEvidence };
