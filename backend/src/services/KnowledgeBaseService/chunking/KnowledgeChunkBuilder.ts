import crypto from "crypto";
import {
  KNOWLEDGE_DEFAULT_CHUNK_OVERLAP,
  KNOWLEDGE_DEFAULT_CHUNK_SIZE,
  KNOWLEDGE_DEFAULT_MIN_CHUNK_SIZE,
  KNOWLEDGE_CHUNKING_VERSION
} from "../../../config/knowledgeBaseConstants";
import { estimateTokensFromChars } from "../embeddings/embeddingUtils";

export type ChunkBuildInput = {
  contentText: string;
  title?: string | null;
  documentType?: string | null;
  language?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  knowledgeBaseId: number;
  knowledgeDocumentId: number;
  chunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
};

export type BuiltChunk = {
  chunkIndex: number;
  content: string;
  chunkHash: string;
  characterStart: number;
  characterEnd: number;
  tokenCount: number;
  tokenCountEstimated: true;
  sectionTitle: string | null;
  title: string | null;
  documentType: string | null;
  language: string | null;
  sourceType: string | null;
  metadata: Record<string, unknown>;
};

function hashChunk(content: string, index: number): string {
  return crypto
    .createHash("sha256")
    .update(`${index}:${content}`)
    .digest("hex");
}

function splitSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?…])\s+/);
  return parts.map(p => p.trim()).filter(Boolean);
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);
}

/**
 * Detecta seções por linhas tipo título (Markdown # ou linha curta em maiúsculas).
 */
function splitSections(
  text: string
): Array<{ title: string | null; body: string }> {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<{ title: string | null; body: string }> = [];
  let currentTitle: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    const body = buf.join("\n").trim();
    if (body) sections.push({ title: currentTitle, body });
    buf = [];
  };

  for (const line of lines) {
    const md = line.match(/^#{1,6}\s+(.+)$/);
    if (md) {
      flush();
      currentTitle = md[1].trim().slice(0, 255);
      continue;
    }
    buf.push(line);
  }
  flush();
  if (!sections.length && text.trim()) {
    return [{ title: null, body: text.trim() }];
  }
  return sections;
}

function packUnits(
  units: string[],
  maxSize: number,
  overlap: number,
  minSize: number
): string[] {
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed.length >= minSize) {
      chunks.push(trimmed);
    } else if (trimmed && chunks.length === 0) {
      // texto curto: manter como único chunk
      chunks.push(trimmed);
    } else if (trimmed && chunks.length > 0) {
      // anexar ao anterior se muito pequeno
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${trimmed}`.trim();
    }
    current = "";
  };

  for (const unit of units) {
    if (!unit) continue;
    if (unit.length > maxSize) {
      pushCurrent();
      // quebra por palavras
      const words = unit.split(/\s+/);
      let part = "";
      for (const w of words) {
        const next = part ? `${part} ${w}` : w;
        if (next.length > maxSize && part) {
          chunks.push(part.trim());
          // overlap por palavras
          if (overlap > 0) {
            const overlapWords = part.split(/\s+/).slice(-Math.ceil(overlap / 6));
            part = overlapWords.join(" ");
            part = part ? `${part} ${w}` : w;
          } else {
            part = w;
          }
        } else {
          part = next;
        }
      }
      if (part.trim()) {
        current = part.trim();
        pushCurrent();
      }
      continue;
    }

    const candidate = current ? `${current} ${unit}` : unit;
    if (candidate.length > maxSize && current) {
      pushCurrent();
      if (overlap > 0 && chunks.length) {
        const prev = chunks[chunks.length - 1];
        const overlapText = prev.slice(Math.max(0, prev.length - overlap));
        current = `${overlapText} ${unit}`.trim();
      } else {
        current = unit;
      }
    } else {
      current = candidate;
    }
  }
  pushCurrent();
  return chunks.filter(c => c.trim().length > 0);
}

/**
 * KnowledgeChunkBuilder — independente de embeddings/vector store.
 * Hierarquia: seções → parágrafos → sentenças → limite + overlap.
 */
export function KnowledgeChunkBuilder(input: ChunkBuildInput): BuiltChunk[] {
  const text = String(input.contentText || "").trim();
  if (!text) return [];

  const chunkSize = Math.max(
    100,
    Number(input.chunkSize) || KNOWLEDGE_DEFAULT_CHUNK_SIZE
  );
  const overlap = Math.max(
    0,
    Math.min(
      Math.floor(chunkSize / 2),
      Number(input.chunkOverlap) || KNOWLEDGE_DEFAULT_CHUNK_OVERLAP
    )
  );
  const minChunkSize = Math.max(
    1,
    Number(input.minChunkSize) || KNOWLEDGE_DEFAULT_MIN_CHUNK_SIZE
  );

  const sections = splitSections(text);
  const rawPieces: Array<{ content: string; sectionTitle: string | null }> = [];

  for (const section of sections) {
    const paragraphs = splitParagraphs(section.body);
    const units: string[] = [];
    for (const p of paragraphs) {
      if (p.length <= chunkSize) units.push(p);
      else units.push(...splitSentences(p));
    }
    const packed = packUnits(units, chunkSize, overlap, minChunkSize);
    for (const content of packed) {
      // Evitar chunk só com título
      if (
        section.title &&
        content.trim() === section.title.trim() &&
        content.length < minChunkSize
      ) {
        continue;
      }
      rawPieces.push({ content, sectionTitle: section.title });
    }
  }

  // Fallback: texto curto único
  if (!rawPieces.length && text) {
    rawPieces.push({ content: text.slice(0, chunkSize), sectionTitle: null });
  }

  let cursor = 0;
  return rawPieces.map((piece, chunkIndex) => {
    const start = text.indexOf(piece.content.slice(0, 40), cursor);
    const characterStart = start >= 0 ? start : cursor;
    const characterEnd = characterStart + piece.content.length;
    cursor = characterEnd;
    return {
      chunkIndex,
      content: piece.content,
      chunkHash: hashChunk(piece.content, chunkIndex),
      characterStart,
      characterEnd,
      tokenCount: estimateTokensFromChars(piece.content),
      tokenCountEstimated: true as const,
      sectionTitle: piece.sectionTitle,
      title: input.title || null,
      documentType: input.documentType || null,
      language: input.language || null,
      sourceType: input.sourceType || null,
      metadata: {
        chunkingVersion: KNOWLEDGE_CHUNKING_VERSION,
        knowledgeBaseId: input.knowledgeBaseId,
        knowledgeDocumentId: input.knowledgeDocumentId,
        sourceUrl: input.sourceUrl || null
      }
    };
  });
}

export default KnowledgeChunkBuilder;
