/**
 * Representação interna de uma mensagem WhatsApp inbound APÓS o parsing do provider.
 *
 * Independente de proto.IWebMessageInfo. Campos derivados do uso real em
 * wbotMessageListener / helpers de JID — não de um contrato Evolution.
 *
 * Fase 4: rawProviderMessage é opcional no pipeline; obrigatório apenas
 * para caminhos que ainda precisam de download/dataJson/compat Baileys.
 */
export type WhatsAppInboundProvider = "baileys" | "evolution";

export type NormalizedWhatsAppAddressing = {
  remoteJid: string;
  participant: string;
  senderPn?: string;
  remoteJidAlt?: string;
  participantPn?: string;
  /** WAMessageKey.participantAlt (PN alternativo). Não substitui participant. */
  participantAlt?: string;
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

export type WhatsAppInboundKind = "message" | "reaction";

export type NormalizedWhatsAppReaction = {
  /** Stanza/id da mensagem alvo no provider. */
  targetStanzaId: string;
  /** Emoji comprovado (text não vazio). Remoção vazia não é contrato desta fase. */
  emoji: string;
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
  /**
   * Semântica do evento. Default "message" quando omitido (fixtures legadas).
   * reaction NÃO deve persistir como balão de timeline.
   */
  kind?: WhatsAppInboundKind;
  reaction?: NormalizedWhatsAppReaction | null;
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
   * COMPATIBILIDADE TRANSITÓRIA (Fase 4).
   *
   * Payload cru do provider. Para Baileys é proto.IWebMessageInfo.
   * Opcional no pipeline provider-agnostic. Ainda necessário para:
   * download de mídia, dataJson completo, n8n legado, isValidMsg fino.
   *
   * NÃO usar em módulos novos. Preferir campos semânticos do DTO.
   */
  rawProviderMessage?: unknown | null;
};

/**
 * Resíduos Baileys ainda documentados após Fase 4.
 * Candidatos a Fase 5 (Evolution) ou cleanup posterior.
 */
export const PHASE5_BAILEYS_RAW_CONSUMERS = [
  "BaileysMediaExtractor (downloadMediaMessage)",
  "dataJson persistido com payload Baileys (quoted outbound / histórico)",
  "n8n webhook json: msg (contrato externo legado — breaking change se removido)",
  "isValidMsg/filterMessages/handleMsgAck (borda Baileys)",
  "groupMetadata / GroupServices (admin de grupo)",
  "lifecycle (initWASocket, QR, logout, rejectCall, heartbeat)",
  "CheckNumber/CheckIsValidContact (onWhatsApp utilitário)",
  "SetTicketMessagesAsRead (dataJson → keys de recibo) — só payloads Baileys",
  "chatbot list/button messages em wbotMessageListener (payload Baileys específico)",
  "Evolution inbound: 12.3-B entra em processInboundAutomation; Chatbot/Typebot/Flow ainda socket-bound (deferidos)",
  "Evolution outbound / Live AI reply (ainda NOT_READY)"
] as const;
