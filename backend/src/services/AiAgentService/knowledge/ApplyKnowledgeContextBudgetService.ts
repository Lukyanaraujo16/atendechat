import { estimateTokensFromChars } from "../../KnowledgeBaseService/embeddings/embeddingUtils";
import type { KnowledgeRetrievalHit } from "./knowledgeRetrievalTypes";

export type ContextBudgetResult = {
  selected: KnowledgeRetrievalHit[];
  contextText: string;
  contextCharacters: number;
  estimatedContextTokens: number;
  truncated: boolean;
};

function softTrimAtWord(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > maxChars * 0.6) {
    return `${slice.slice(0, lastSpace).trimEnd()}…`;
  }
  return `${slice.trimEnd()}…`;
}

/**
 * Monta bloco <knowledge_context> respeitando orçamento de caracteres/tokens.
 */
export default function ApplyKnowledgeContextBudgetService(input: {
  hits: KnowledgeRetrievalHit[];
  maxContextCharacters: number;
  maxContextTokens: number;
}): ContextBudgetResult {
  const maxChars = Math.max(200, Number(input.maxContextCharacters) || 6000);
  const maxTokens = Math.max(50, Number(input.maxContextTokens) || 1500);
  // Reserva margem para delimitadores (~10%)
  const charBudget = Math.floor(maxChars * 0.9);
  const tokenBudget = Math.floor(maxTokens * 0.9);

  const selected: KnowledgeRetrievalHit[] = [];
  const parts: string[] = ["<knowledge_context>"];
  let chars = 0;
  let truncated = false;

  for (let i = 0; i < input.hits.length; i += 1) {
    const hit = input.hits[i];
    const header = [
      `Fonte ${i + 1}`,
      `Base: ${hit.knowledgeBaseName || hit.knowledgeBaseId}`,
      `Documento: ${hit.documentTitle || hit.documentId}`,
      hit.sectionTitle ? `Seção: ${hit.sectionTitle}` : null,
      `Tipo: ${hit.documentType || "—"}`,
      `Score: ${hit.similarityScore.toFixed(4)}`
    ]
      .filter(Boolean)
      .join("\n");

    let body = String(hit.content || "").trim();
    if (!body) continue;

    const remainingChars = charBudget - chars - header.length - 24;
    if (remainingChars < 40) {
      truncated = true;
      break;
    }

    const provisional = `${header}\nConteúdo:\n${body}`;
    const provisionalTokens = estimateTokensFromChars(provisional);
    const usedTokens = estimateTokensFromChars(parts.join("\n"));
    if (usedTokens + provisionalTokens > tokenBudget) {
      const tokenRoom = Math.max(
        0,
        (tokenBudget - usedTokens) * 4 - header.length - 24
      );
      if (tokenRoom < 40) {
        truncated = true;
        break;
      }
      body = softTrimAtWord(body, Math.min(remainingChars, tokenRoom));
      truncated = true;
    } else if (body.length > remainingChars) {
      body = softTrimAtWord(body, remainingChars);
      truncated = true;
    }

    const block = `${header}\nConteúdo:\n${body}`;
    parts.push("", block);
    selected.push({ ...hit, content: body });
    chars += block.length + 2;
    if (truncated) break;
  }

  parts.push("", "</knowledge_context>");
  const contextText =
    selected.length > 0 ? parts.join("\n").trim() : "";

  return {
    selected,
    contextText,
    contextCharacters: contextText.length,
    estimatedContextTokens: estimateTokensFromChars(contextText),
    truncated
  };
}

export function BuildKnowledgeContextService(input: {
  hits: KnowledgeRetrievalHit[];
  maxContextCharacters: number;
  maxContextTokens: number;
}): ContextBudgetResult {
  return ApplyKnowledgeContextBudgetService(input);
}
