import { NormalizedWhatsAppMessage } from "./NormalizedWhatsAppMessage";

export type ProcessInboundWhatsAppMessageDeps = {
  /**
   * Handler legado (handleMessage). Fase 1: ainda opera sobre
   * inbound.rawProviderMessage (proto.IWebMessageInfo).
   *
   * Não adicionar novos consumidores de rawProviderMessage.
   */
  handleLegacyBaileysMessage: (
    inbound: NormalizedWhatsAppMessage
  ) => Promise<void>;
};

/**
 * Pipeline inbound WhatsApp independente de provider (Fase 1).
 *
 * Etapas de domínio que permanecem no handleMessage legado nesta fase:
 * - localizar/criar contato
 * - localizar/criar ticket
 * - persistir mensagem
 * - chatbot / Flow / Typebot / IA
 * - Socket.IO / notificações
 *
 * A fronteira já existe: o listener Baileys não chama handleMessage direto;
 * converte para NormalizedWhatsAppMessage e entra por aqui.
 */
export async function processInboundWhatsAppMessage(
  inbound: NormalizedWhatsAppMessage,
  deps: ProcessInboundWhatsAppMessageDeps
): Promise<void> {
  if (inbound.provider !== "baileys") {
    throw new Error(
      `ProcessInboundWhatsAppMessage Fase 1 aceita apenas provider baileys. Recebido: ${String(
        inbound.provider
      )}`
    );
  }
  if (inbound.rawProviderMessage == null) {
    throw new Error(
      "ProcessInboundWhatsAppMessage Fase 1 exige rawProviderMessage para o handler legado"
    );
  }
  await deps.handleLegacyBaileysMessage(inbound);
}
