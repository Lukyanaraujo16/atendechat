/**
 * Contrato outbound WhatsApp independente de WASocket.
 *
 * Fase 2: único provider real é "baileys". Consumidores de domínio devem
 * depender deste contrato, não de GetTicketWbot / wbot.sendMessage.
 */

export type WhatsAppOutboundProvider = "baileys" | "evolution";

export type WhatsAppOutboundSendResult = {
  messageId: string | null;
  remoteJid: string | null;
  fromMe: boolean;
  status: number | null;
  /**
   * Payload do envio para dataJson / compat.
   * Baileys: WAMessage. Evolution: envelope { provider, key, ... } (não proto).
   */
  rawSentMessage: unknown;
};

/**
 * Quoted provider-agnostic (Fase 9B).
 * Baileys: continua preferindo `dataJson` (WAMessage).
 * Evolution: usa campos semânticos (stanzaId/fromMe/participant) — NÃO interpreta dataJson como proto.
 */
export type WhatsAppQuotedMessage = {
  /** LEGACY Baileys — opcional quando stanzaId está presente. */
  dataJson?: string | Record<string, unknown> | null;
  destinationJid: string;
  isGroup: boolean;
  /** Id canônico da mensagem citada (Message.id / key.id). */
  stanzaId?: string;
  fromMe?: boolean;
  participant?: string | null;
  /** Texto/contexto opcional para Evolution `quoted.message.conversation`. */
  body?: string | null;
};

export type WhatsAppReadKey = {
  remoteJid: string;
  id: string;
  fromMe: boolean;
  participant?: string;
};

export type WhatsAppPresence = "composing" | "paused" | "unavailable";

export type WhatsAppDeleteTarget = {
  id: string;
  remoteJid: string;
  participant?: string | null;
  fromMe: boolean;
};

export interface WhatsAppOutbound {
  readonly provider: WhatsAppOutboundProvider;

  sendText(input: {
    jid: string;
    text: string;
    quoted?: WhatsAppQuotedMessage | null;
  }): Promise<WhatsAppOutboundSendResult>;

  /**
   * Conteúdo já montado pelos serviços atuais (mídia, campanha, sticker, Typebot).
   * Forma alinhada ao objeto passado hoje a wbot.sendMessage(jid, content).
   * Não redesenha payload Baileys.
   */
  sendContent(input: {
    jid: string;
    content: Record<string, unknown>;
  }): Promise<WhatsAppOutboundSendResult>;

  deleteMessage(input: {
    jid: string;
    target: WhatsAppDeleteTarget;
  }): Promise<void>;

  markAsRead(keys: WhatsAppReadKey[]): Promise<void>;

  sendPresence(input: {
    jid?: string;
    presence: WhatsAppPresence;
    subscribe?: boolean;
  }): Promise<boolean>;

  getOwnUserJid(): string | null;
}

/**
 * Consumidores que ainda chamam WASocket / sendMessage fora desta fronteira.
 * Trabalho da Fase 3 (e grupos/lifecycle).
 */
export const PHASE3_WHATSAPP_SOCKET_CONSUMERS = [
  "services/WbotServices/wbotMonitor.ts (rejectCall + mensagem pós-rejeição — lifecycle)",
  "helpers/whatsappUnavailablePresence.ts (heartbeat unavailable — conexão, não domínio)",
  "libs/wbot.ts (logout/lifecycle)",
  "controllers/WhatsAppSessionController.ts (logout)",
  "helpers/GetWbotMessage.ts (GetTicketWbot residual; fetch já é DB)",
  "services/AiAgentService/startAiAgentTypingPresence.ts (GetTicketWbot + wrapBaileysSession por compatibilidade de testes)",
  "services/TypebotServices/typebotListener.ts (ainda recebe WASocket do inbound; envio via wrapBaileysSession)",
  "helpers/SendMessageFlow.ts (GetWhatsappWbot; sendMessage comentado)",
  "GroupServices/* groupMetadata (admin de grupo)",
  "helpers/groupContactName.ts (groupMetadata)",
  "quoted semântico (stanzaId) + dataJson Baileys compat (SendWhatsAppMessage / outbound)",
  "n8n/webhook json: msg (legacyBaileysPayload — contrato externo)",
  "chatbot list/button payloads Baileys em wbotMessageListener (via sendOutboundContent)"
] as const;
