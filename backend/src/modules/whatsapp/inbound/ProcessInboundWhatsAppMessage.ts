import { NormalizedWhatsAppMessage } from "./NormalizedWhatsAppMessage";

export type ProcessInboundWhatsAppMessageDeps = {
  /**
   * Handler de domínio. Recebe NormalizedWhatsAppMessage.
   * rawProviderMessage é opcional; use tryGetBaileysRawMessage / requireBaileysRawMessage
   * apenas nos caminhos que ainda precisam dele.
   */
  handleInboundMessage: (inbound: NormalizedWhatsAppMessage) => Promise<void>;
};

/**
 * Pipeline inbound WhatsApp independente de provider.
 *
 * Fase 6: aceita baileys | evolution.
 * rawProviderMessage continua opcional; Evolution texto não o usa.
 */
export async function processInboundWhatsAppMessage(
  inbound: NormalizedWhatsAppMessage,
  deps: ProcessInboundWhatsAppMessageDeps
): Promise<void> {
  if (inbound.provider !== "baileys" && inbound.provider !== "evolution") {
    throw new Error(
      `ProcessInboundWhatsAppMessage aceita baileys|evolution. Recebido: ${String(
        inbound.provider
      )}`
    );
  }
  await deps.handleInboundMessage(inbound);
}

/**
 * Operações do pipeline que ainda exigem raw Baileys quando presentes.
 * Usado por testes de contrato sem raw.
 */
export const OPERATIONS_REQUIRING_RAW_PROVIDER_MESSAGE = [
  "downloadMedia / BaileysMediaExtractor",
  "persistência dataJson com payload Baileys completo",
  "n8n/webhook json: msg (contrato legado)",
  "isValidMsg fino baseado em msg.message (fallback: messageType do DTO)",
  "OpenAI legado branch áudio (msg.message.audioMessage) quando não houver DTO media"
] as const;
