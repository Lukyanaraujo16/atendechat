/**
 * Assinatura determinística de mensagens do AI Agent (Fase 2.16).
 * Formato: `<nome>:\n<conteúdo>`
 * Não altera mensagens humanas — aplicar apenas em envio automático do agente.
 */

const FALLBACK_AGENT_NAME = "Assistente";

function normalizeAgentName(raw: string | null | undefined): string {
  const collapsed = String(raw ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return FALLBACK_AGENT_NAME;
  // Remove prefixo markdown bold residual (*Nome*:)
  return collapsed.replace(/^\*+|\*+$/g, "").trim() || FALLBACK_AGENT_NAME;
}

function normalizeContent(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

/**
 * Prefixo de assinatura no início do texto.
 * Aceita: `Nome:`, `*Nome*:`, `*Nome:*` (formato humano WhatsApp).
 */
function leadingSignatureRegex(escapedName: string): RegExp {
  // Ordem: `*Nome*:`, depois `Nome:` / `*Nome:` / `*Nome:*`
  return new RegExp(`^\\*?${escapedName}(?:\\*:|:\\*?)\\s*\\n?`, "i");
}

/**
 * Detecta se o conteúdo já começa com a assinatura do agente
 * (com ou sem negrito WhatsApp `*Nome*:` / `*Nome:*`).
 */
export function contentAlreadyHasAiAgentSignature(
  content: string,
  agentName: string
): boolean {
  const name = normalizeAgentName(agentName);
  const text = normalizeContent(content);
  if (!text) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return leadingSignatureRegex(escaped).test(text);
}

/**
 * Remove assinatura duplicada no início (plain ou negrito WhatsApp).
 */
export function stripLeadingAiAgentSignature(
  content: string,
  agentName: string
): string {
  const name = normalizeAgentName(agentName);
  let text = normalizeContent(content);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = leadingSignatureRegex(escaped);
  while (re.test(text)) {
    text = text.replace(re, "").trim();
  }
  return text;
}

export type FormatAiAgentSignedMessageInput = {
  agentName: string | null | undefined;
  content: string | null | undefined;
};

export type FormatAiAgentSignedMessageResult = {
  body: string;
  agentName: string;
  signed: boolean;
  deduped: boolean;
};

/**
 * Aplica exatamente uma assinatura no início do conteúdo.
 * Conteúdo vazio → string vazia (caller decide fallback).
 */
export function formatAiAgentSignedMessage(
  input: FormatAiAgentSignedMessageInput
): FormatAiAgentSignedMessageResult {
  const agentName = normalizeAgentName(input.agentName);
  const rawContent = normalizeContent(input.content);
  if (!rawContent) {
    return { body: "", agentName, signed: false, deduped: false };
  }

  const hadSignature = contentAlreadyHasAiAgentSignature(rawContent, agentName);
  const content = stripLeadingAiAgentSignature(rawContent, agentName);
  if (!content) {
    return { body: "", agentName, signed: false, deduped: hadSignature };
  }

  return {
    body: `${agentName}:\n${content}`,
    agentName,
    signed: true,
    deduped: hadSignature
  };
}

export function resolveAiAgentPublicName(
  agentName: string | null | undefined
): string {
  return normalizeAgentName(agentName);
}

export { FALLBACK_AGENT_NAME };
