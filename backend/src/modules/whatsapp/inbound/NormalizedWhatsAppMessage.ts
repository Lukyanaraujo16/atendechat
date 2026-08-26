/**
 * Representação interna de uma mensagem WhatsApp inbound APÓS o parsing do provider.
 *
 * Independente de proto.IWebMessageInfo. Campos derivados do uso real em
 * wbotMessageListener / helpers de JID — não de um contrato Evolution.
 *
 * Fase 3: único provider existente é "baileys". O pipeline de domínio deve
 * preferir estes campos em vez do payload cru.
 */
export type WhatsAppInboundProvider = "baileys";

export type NormalizedWhatsAppAddressing = {
  remoteJid: string;
  participant: string;
  senderPn?: string;
  remoteJidAlt?: string;
  participantPn?: string;
};

export type NormalizedWhatsAppMediaMetadata = {
  hasMedia: boolean;
  mimetype: string | null;
  filename: string | null;
  caption: string | null;
  isPtt: boolean;
};

export type NormalizedWhatsAppWrapping = {
  isEphemeral: boolean;
  isViewOnce: boolean;
};

export type NormalizedWhatsAppMessage = {
  provider: WhatsAppInboundProvider;
  companyId: number;
  whatsappId: number;
  messageId: string;
  fromMe: boolean;
  timestamp: Date | null;
  messageType: string | null;
  body: string | null;
  pushName: string | null;
  isGroup: boolean;
  addressing: NormalizedWhatsAppAddressing;
  /**
   * Número E.164-ish (somente dígitos) quando as regras atuais de JID/LID
   * conseguem extraí-lo sem side-effect. Null se @lid sem PN, grupo sem
   * participantPn, etc. Não substitui Contact.number.
   */
  senderNumber: string | null;
  quotedStanzaId: string | null;
  mentionedJids: string[];
  media: NormalizedWhatsAppMediaMetadata;
  wrapping: NormalizedWhatsAppWrapping;
  messageStubType: number | null;
  /**
   * ACK numérico do provider (Baileys `msg.status`). Não normalizar nesta fase.
   */
  ack: number | null;
  /**
   * Id da mensagem original quando o tipo é editedMessage.
   */
  editedMessageId: string | null;
  /**
   * COMPATIBILIDADE TRANSITÓRIA (Fase 3).
   *
   * Payload cru do provider. Para Baileys é proto.IWebMessageInfo.
   *
   * Ainda necessário para: dataJson, downloadMedia, quoted lookup,
   * n8n/webhook (json: msg), LID resolveInboundContactFromMessage,
   * groupMetadata e alguns ramos OpenAI/chatbot.
   *
   * NÃO usar em módulos novos. Não é mais o argumento principal de handleMessage.
   */
  rawProviderMessage: unknown;
};

/**
 * Consumidores que ainda dependem de proto.IWebMessageInfo / payload Baileys cru.
 * Trabalho da Fase 4 — não adicionar novos itens.
 */
export const PHASE4_BAILEYS_RAW_CONSUMERS = [
  "services/WbotServices/wbotMessageListener.ts (downloadMedia, verifyQuotedMessage, verifyContact LID, isValidMsg, filterMessages, handleMsgAck, n8n json:msg, groupMetadata, chatbot/OpenAI outbound sendMessage)",
  "services/WbotServices/providers.ts (outbound sendMessage + getBodyMessage residual)",
  "services/TypebotServices/typebotListener.ts (msg opcional no caminho ActionsWebhook)",
  "services/IntegrationsServices/OpenAiService.ts (branch áudio + wbot.sendMessage legado)",
  "services/WebhookService/ActionsWebhookService.ts (msg proto opcional no fluxo)",
  "helpers/extractMessageReceivedAt.ts (adapter Baileys)",
  "helpers/SetTicketMessagesAsRead.ts (dataJson Baileys para recibos — ACK fora desta fase)",
  "verifyMessage/verifyMediaMessage (dataJson + quoted + download; campos semânticos já preferem o DTO quando informado)"
] as const;
