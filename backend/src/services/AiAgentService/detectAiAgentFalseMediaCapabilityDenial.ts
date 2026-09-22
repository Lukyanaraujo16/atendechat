/**
 * Fase 2.20.4 — Detecção de negação falsa de capacidade visual.
 * Distingue “não consigo ver imagens” (incapacidade) de limitação legítima
 * (“a imagem está desfocada / não consigo ler o texto pequeno”).
 */

export type AiAgentFalseMediaCapabilityDenialResult = {
  isFalseDenial: boolean;
  /** Motivo estável para logs (sem texto do cliente). */
  reason: string | null;
};

/** Normaliza para matching: minúsculas, sem acentos, pontuação → espaço. */
export function normalizeAiAgentDenialText(raw: string | null | undefined): string {
  const base = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base;
}

/** Remove prefixo de assinatura "Nome:\n" se presente. */
export function stripAiAgentSignedPrefix(raw: string | null | undefined): string {
  const t = String(raw || "").trim();
  const m = t.match(/^([^\n:]{1,80}):\s*\n([\s\S]*)$/);
  if (m && m[2].trim()) return m[2].trim();
  return t;
}

const LEGITIMATE_LIMITATION_RE = [
  /\b(desfocad[ao]|borrad[ao]|ilegivel|nitidez|pouca luz|mal iluminad|cortad[ao]|parcialmente visivel)\b/,
  /\bnao\s+consigo\s+(identificar|ler|confirmar|distinguir|determinar|decifrar)\b/,
  /\bnao\s+(e|eh)\s+possivel\s+(identificar|ler|confirmar|determinar|afirmar)\b/,
  /\bnao\s+consigo\s+ver\s+(com\s+clareza|o\s+texto|os?\s+detalhes?|a\s+marca|o\s+modelo)\b/,
  /\bcannot\s+(make\s+out|read|confirm|determine|identify)\b/,
  /\b(blurry|out\s+of\s+focus|illegible|too\s+dark|cropped)\b/
];

const IMAGE_OR_PHOTO =
  "(imagens?|fotos?|a\\s+imagem|a\\s+foto|essa\\s+imagem|essa\\s+foto|esta\\s+imagem|esta\\s+foto)";

const CAPABILITY_DENIAL_RE = [
  // PT — incapacidade genérica de ver/analisar imagens
  new RegExp(
    `\\bnao\\s+consigo\\s+(visualizar|ver|analisar|enxergar|abrir|interpretar|descrever)\\s+${IMAGE_OR_PHOTO}\\b`
  ),
  /\bnao\s+tenho\s+(a\s+)?capacidade\s+(de\s+)?(visualizar|ver|analisar)\b/,
  /\bnao\s+tenho\s+acesso\s+(a|à|á)?\s*(imagem|foto|imagens|fotos)\b/,
  new RegExp(
    `\\bnao\\s+posso\\s+(acessar|ver|visualizar|analisar|descrever)\\s+${IMAGE_OR_PHOTO}\\b`
  ),
  /\bnao\s+sou\s+capaz\s+de\s+(ver|visualizar|analisar)\s+(imagens?|fotos?)?\b/,
  /\bnao\s+tenho\s+acesso\s+(a|à|á)?\s*(imagem|foto|imagens|fotos)\b/,
  /\b(desculpe|desculpa).{0,40}nao\s+consigo\s+(visualizar|ver|descrever)\s+(imagens?|fotos?)\b/,
  /\benvie\s+(uma\s+)?descricao\s+(da\s+imagem|em\s+texto|do\s+que\s+aparece)\b/,
  /\bdescreva\s+(o\s+que\s+(aparece|ha|tem)\s+na\s+imagem|a\s+imagem\s+em\s+texto)\b/,
  /\bnao\s+consigo\s+interpretar\s+(fotos?|imagens?)\b/,
  // "não consigo descrever o que aparece nesta/na imagem" (E2E 12.4-F)
  /\bnao\s+consigo\s+descrever\s+o\s+que\s+(aparece|ha|tem)\s+(nesta|nessa|na|desta|dessa)\s+(imagem|foto)\b/,
  // EN
  /\bi\s+(cannot|cant)\s+(see|view|visualize|analyse|analyze|inspect|open)\s+(images?|photos?|the\s+image|the\s+photo)\b/,
  /\bi\s+(cannot|cant|am\s+unable\s+to)\s+describe\s+(what\s+(appears|is)\s+in\s+(the\s+)?(image|photo)|this\s+image|this\s+photo|the\s+image|the\s+photo)\b/,
  /\bi\s+(do\s+not|dont)\s+have\s+(access|the\s+ability)\s+to\s+(see|view|images?|photos?)\b/,
  /\bplease\s+describe\s+(the\s+)?(image|photo)\b/,
  /\bi\s+am\s+unable\s+to\s+(see|view|analyze|analyse)\s+(images?|photos?)\b/
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(re => re.test(text));
}

/**
 * True quando o texto nega capacidade de ver/analisar imagens de forma genérica.
 * False para limitações específicas do conteúdo (desfoque, texto ilegível, etc.).
 */
export function detectAiAgentFalseMediaCapabilityDenial(
  raw: string | null | undefined
): AiAgentFalseMediaCapabilityDenialResult {
  const stripped = stripAiAgentSignedPrefix(raw);
  const norm = normalizeAiAgentDenialText(stripped);
  if (!norm || norm.length < 8) {
    return { isFalseDenial: false, reason: null };
  }

  const hasCapabilityDenial = matchesAny(norm, CAPABILITY_DENIAL_RE);
  if (!hasCapabilityDenial) {
    return { isFalseDenial: false, reason: null };
  }

  const hasLegitimate = matchesAny(norm, LEGITIMATE_LIMITATION_RE);
  // Limitação específica + sem generalização "não vejo imagens" em plural/capacidade:
  // se casou CAPABILITY e também LEGITIMATE, ainda conta como negação falsa
  // quando o núcleo é incapacidade genérica (já casou CAPABILITY).
  // Exceção: "nao consigo ver o texto" já está em LEGITIMATE e NÃO em CAPABILITY.
  if (hasLegitimate && !/\b(imagens?|fotos?)\b/.test(norm)) {
    return { isFalseDenial: false, reason: null };
  }

  return { isFalseDenial: true, reason: "false_vision_capability_denial" };
}

/** Filtra histórico: mensagens do atendente com negação de visão / fallbacks de mídia. */
export function shouldOmitAiAgentHistoryLineForVision(
  body: string | null | undefined
): boolean {
  const stripped = stripAiAgentSignedPrefix(body);
  const norm = normalizeAiAgentDenialText(stripped);
  if (!norm) return false;

  if (detectAiAgentFalseMediaCapabilityDenial(stripped).isFalseDenial) {
    return true;
  }

  // Fallbacks fixos de mídia / visão não suportada
  if (
    norm.includes("nao consegui visualizar essa imagem com clareza") ||
    norm.includes("este agente ainda nao esta configurado para analisar fotos") ||
    norm.includes("nao consegui compreender bem o audio")
  ) {
    return true;
  }

  return false;
}

export const AI_AGENT_VISION_ATTACHED_TURN_INSTRUCTION = [
  "Instrução de turno (sistema — imagens anexadas a esta solicitação):",
  "- Uma ou mais imagens foram anexadas a este request; analise o conteúdo visual recebido.",
  "- Não diga que não consegue visualizar, ver ou analisar imagens.",
  "- Não peça descrição da imagem apenas por limitação genérica de capacidade.",
  "- Se algum detalhe estiver ilegível, descreva o que observou e informe só a limitação específica.",
  "- Não invente elementos que não aparecem.",
  "- Responda à pergunta do cliente com base na imagem e no contexto."
].join("\n");

export const AI_AGENT_VISION_REGEN_INSTRUCTION = [
  "Correção obrigatória:",
  "A resposta anterior negou incorretamente a capacidade de ver imagens, mas a imagem ESTÁ anexada.",
  "Analise o conteúdo visual e responda de novo.",
  "Não diga que não consegue visualizar imagens.",
  "Se algo estiver ilegível, descreva o que conseguiu ver e a limitação específica."
].join("\n");

/** Fallback determinístico se a regeneração ainda negar capacidade. */
export const AI_AGENT_VISION_FALSE_DENIAL_FALLBACK_MESSAGE =
  "Recebi sua imagem. Pode me dizer o que deseja saber sobre ela para eu analisar o conteúdo visual com foco no que importa para você?";
