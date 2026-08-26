import { getIO } from "../../../../../libs/socket";
import Message from "../../../../../models/Message";
import Ticket from "../../../../../models/Ticket";
import Whatsapp from "../../../../../models/Whatsapp";
import notifyTicketInboundMessage from "../../../../../services/OneSignalPush/notifyTicketInboundMessage";
import { serializeMessageForClient } from "../../../../../services/MessageServices/CreateMessageService";
import { NormalizedWhatsAppMessage } from "../../../inbound/NormalizedWhatsAppMessage";

export type EvolutionInboundMessagePersistInput = {
  inbound: NormalizedWhatsAppMessage;
  ticket: Ticket;
  contactId: number;
  quotedMsgId?: string | null;
  /** Envelope sanitizado (sem apikey/base64) para dataJson provider-aware. */
  evolutionPayloadSanitized: Record<string, unknown>;
  /** Filename relativo sob public/ (padrão Baileys). */
  mediaUrl?: string | null;
  /**
   * mediaType persistido: major MIME ("image") para arquivos;
   * messageType completo para location/contact/reaction/texto.
   */
  persistedMediaType?: string | null;
};

function resolvePersistedMediaType(
  inbound: NormalizedWhatsAppMessage,
  override?: string | null
): string {
  if (override) return override;
  if (inbound.media.hasMedia && inbound.media.mimetype) {
    return inbound.media.mimetype.split("/")[0] || "application";
  }
  return inbound.messageType || "conversation";
}

/**
 * Persistência inbound Evolution (texto + mídia Fase 7).
 * channel=whatsapp; dataJson = payload Evolution sanitizado (não Baileys).
 */
export async function createEvolutionInboundMessage(
  input: EvolutionInboundMessagePersistInput
): Promise<Message> {
  const {
    inbound,
    ticket,
    contactId,
    quotedMsgId,
    evolutionPayloadSanitized,
    mediaUrl,
    persistedMediaType
  } = input;
  const { companyId } = inbound;

  await Message.upsert({
    id: inbound.messageId,
    ticketId: ticket.id,
    contactId: inbound.fromMe ? undefined : contactId,
    body: inbound.body || "",
    fromMe: inbound.fromMe,
    read: inbound.fromMe,
    mediaType: resolvePersistedMediaType(inbound, persistedMediaType),
    mediaUrl: mediaUrl || null,
    ack: inbound.fromMe ? 2 : 0,
    channel: "whatsapp",
    externalMessageId: inbound.messageId,
    quotedMsgId: quotedMsgId || null,
    remoteJid: inbound.addressing.remoteJid,
    participant: inbound.addressing.participant || null,
    dataJson: JSON.stringify({
      provider: "evolution",
      payload: evolutionPayloadSanitized
    }),
    queueId: ticket.queueId,
    companyId
  } as never);

  const message = await Message.findByPk(inbound.messageId, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name", "ticketVisibility", "connectionProvider"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (!message) {
    throw new Error("ERR_CREATING_EVOLUTION_MESSAGE");
  }

  if (message.ticket.queueId !== null && message.queueId === null) {
    await message.update({ queueId: message.ticket.queueId });
  }

  const io = getIO();
  const outboundMessage = serializeMessageForClient(message);
  const { queueId } = message.ticket;

  let emitTarget = io
    .to(message.ticketId.toString())
    .to(`company-${companyId}-${message.ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`company-${companyId}-mainchannel`);

  if (queueId != null) {
    emitTarget = emitTarget
      .to(`queue-${queueId}-${message.ticket.status}`)
      .to(`queue-${queueId}-notification`);
  }

  emitTarget.emit(`company-${companyId}-appMessage`, {
    action: "create",
    message: outboundMessage,
    ticket: message.ticket,
    contact: message.ticket.contact
  });

  if (!inbound.fromMe) {
    // eslint-disable-next-line no-void
    void notifyTicketInboundMessage({ message, companyId });
  }

  return message;
}
