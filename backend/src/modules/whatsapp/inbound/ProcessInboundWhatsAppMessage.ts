import { NormalizedWhatsAppMessage } from "./NormalizedWhatsAppMessage";

export type ProcessInboundWhatsAppMessageDeps = {
  /**
   * Handler de domínio. Recebe NormalizedWhatsAppMessage (Fase 3).
   * rawProviderMessage só deve ser usado via requireBaileysRawMessage
   * para resíduos documentados.
   */
  handleInboundMessage: (inbound: NormalizedWhatsAppMessage) => Promise<void>;
};

/**
 * Pipeline inbound WhatsApp independente de provider.
 *
 * Fase 3: o handler principal opera sobre NormalizedWhatsAppMessage.
 * Contato/ticket/persistência/chatbot/Flow/Typebot/IA devem preferir o DTO.
 */
export async function processInboundWhatsAppMessage(
  inbound: NormalizedWhatsAppMessage,
  deps: ProcessInboundWhatsAppMessageDeps
): Promise<void> {
  if (inbound.provider !== "baileys") {
    throw new Error(
      `ProcessInboundWhatsAppMessage aceita apenas provider baileys. Recebido: ${String(
        inbound.provider
      )}`
    );
  }
  if (inbound.rawProviderMessage == null) {
    throw new Error(
      "ProcessInboundWhatsAppMessage ainda exige rawProviderMessage para compatibilidade transitória (mídia/dataJson/LID)"
    );
  }
  await deps.handleInboundMessage(inbound);
}
