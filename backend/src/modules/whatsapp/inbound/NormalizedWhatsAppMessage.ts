/**
 * Representação interna de uma mensagem WhatsApp inbound APÓS o parsing do provider.
 *
 * Independente de proto.IWebMessageInfo. Campos derivados do uso real em
 * wbotMessageListener / helpers de JID — não de um contrato Evolution.
 *
 * Fase 1: único provider existente é "baileys". Não adicionar outros valores
 * até a Fase 2.
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
   * participantPn, etc. Não substitui Contact.number nesta fase.
   */
  senderNumber: string | null;
  quotedStanzaId: string | null;
  mentionedJids: string[];
  media: NormalizedWhatsAppMediaMetadata;
  wrapping: NormalizedWhatsAppWrapping;
  messageStubType: number | null;
  /**
   * COMPATIBILIDADE TRANSITÓRIA (Fase 1).
   *
   * Payload cru do provider. Para Baileys é proto.IWebMessageInfo.
   *
   * Ainda necessário para handleMessage, persistência (dataJson), mídia
   * (downloadMediaMessage), quoted, Typebot, OpenAI legado, Flow, AI Agent
   * e providers.ts.
   *
   * NÃO usar em módulos novos. Remover na Fase 3.
   */
  rawProviderMessage: unknown;
};

/**
 * Consumidores que ainda dependem de proto.IWebMessageInfo / payload Baileys cru.
 * Lista de trabalho da Fase 3 — não adicionar novos itens.
 */
export const PHASE3_BAILEYS_RAW_CONSUMERS = [
  "services/WbotServices/wbotMessageListener.ts (handleMessage, verifyMessage, verifyMediaMessage, downloadMedia, verifyContact, handleOpenAi, handleChartbot, flowbuilderIntegration, handleMessageIntegration, handleMsgAck, filterMessages, isValidMsg)",
  "services/WbotServices/providers.ts",
  "services/TypebotServices/typebotListener.ts",
  "services/IntegrationsServices/OpenAiService.ts",
  "services/WebhookService/ActionsWebhookService.ts",
  "services/FlowBuilderService/EvaluateFlowConditionService.ts",
  "services/AiAgentService/classifyInboundMessage.ts (classifyInboundMessageFromBaileys)",
  "services/AiAgentService/runAiAgentDryRunHook.ts",
  "helpers/extractMessageReceivedAt.ts",
  "helpers/SetTicketMessagesAsRead.ts"
] as const;
