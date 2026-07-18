import crypto from "crypto";

/**
 * Constrói query de recuperação determinística (sem LLM).
 * Núcleo = mensagem atual; opcionalmente anexa contexto recente relevante.
 */
export default function BuildKnowledgeRetrievalQueryService(input: {
  currentMessage: string;
  recentMessages?: Array<{ role?: string; content?: string }>;
  maxRecentChars?: number;
}): string {
  const current = String(input.currentMessage || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!current) return "";

  const maxRecent = Math.max(0, input.maxRecentChars ?? 280);
  const recent = (input.recentMessages || [])
    .filter(m => m && String(m.content || "").trim())
    .slice(-4);

  // Pronomes / perguntas curtas beneficiam de contexto recente do usuário
  const needsContext =
    current.length < 80 ||
    /\b(ele|ela|isso|isto|aquele|aquela|dele|dela|desse|dessa|e a|e o)\b/i.test(
      current
    ) ||
    /\?\s*$/.test(current);

  if (!needsContext || !recent.length || maxRecent === 0) {
    return current.slice(0, 2000);
  }

  const userBits: string[] = [];
  let budget = maxRecent;
  for (let i = recent.length - 1; i >= 0 && budget > 0; i -= 1) {
    const m = recent[i];
    if (String(m.role || "").toLowerCase() === "assistant") continue;
    const text = String(m.content || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || text === current) continue;
    const slice = text.slice(0, budget);
    userBits.unshift(slice);
    budget -= slice.length + 1;
  }

  if (!userBits.length) return current.slice(0, 2000);

  const context = userBits.join(" ").trim();
  return `${current} — contexto: ${context}`.slice(0, 2000);
}

export function hashKnowledgeQuery(query: string): string {
  return crypto.createHash("sha256").update(query).digest("hex");
}

export function previewKnowledgeQuery(query: string, max = 200): string {
  const q = String(query || "").trim();
  if (q.length <= max) return q;
  return `${q.slice(0, max - 1)}…`;
}
