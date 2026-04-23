import { proto, WASocket } from "@whiskeysockets/baileys";
// import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

/**
 * Opções para {@link SetTicketMessagesAsRead}.
 *
 * `syncWhatsAppReadReceipt: true` só deve ser usado quando um atendente humano
 * está visualizando a conversa no painel (ex.: GET da lista paginada de mensagens do ticket).
 * Fluxos automáticos (webhook, fila, API de mensagens, etc.) devem omitir ou passar `false`.
 */
export type SetTicketMessagesAsReadOptions = {
  syncWhatsAppReadReceipt?: boolean;
};

/** Confirmação de leitura no WhatsApp: usar apenas no fluxo de visualização humana no painel. */
export const HUMAN_PANEL_CONVERSATION_VIEW_WHATSAPP_READ: SetTicketMessagesAsReadOptions =
  {
    syncWhatsAppReadReceipt: true
  };

/** `Messages.dataJson` é TEXT com JSON stringificado; normaliza para IWebMessageInfo. */
function parseInboundWebMessageInfo(
  raw: string | null | undefined
): proto.IWebMessageInfo | null {
  if (raw == null || raw === "") {
    return null;
  }
  try {
    if (typeof raw === "string") {
      return JSON.parse(raw) as proto.IWebMessageInfo;
    }
    return JSON.parse(JSON.stringify(raw)) as proto.IWebMessageInfo;
  } catch {
    return null;
  }
}

/**
 * Zera não lidas no ticket, marca mensagens como lidas no banco e notifica o socket.
 * Opcionalmente envia `chatModify(markRead)` ao WhatsApp — apenas quando
 * `syncWhatsAppReadReceipt` for true e a conexão tiver `autoReadMessages` ativo.
 */
const SetTicketMessagesAsRead = async (
  ticket: Ticket,
  options: SetTicketMessagesAsReadOptions = {}
): Promise<void> => {
  const { syncWhatsAppReadReceipt = false } = options;

  await ticket.update({ unreadMessages: 0 });
  // await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

  try {
    if (syncWhatsAppReadReceipt) {
      const pendingInbound = await Message.findAll({
        where: {
          ticketId: ticket.id,
          fromMe: false,
          read: false
        },
        order: [["createdAt", "DESC"]]
      });

      if (pendingInbound.length > 0) {
        const whatsapp = await Whatsapp.findByPk(ticket.whatsappId, {
          attributes: ["autoReadMessages"]
        });
        const allowWhatsAppReceipt =
          whatsapp ? whatsapp.autoReadMessages !== false : true;

        if (allowWhatsAppReceipt) {
          const wbot = await GetTicketWbot(ticket);
          if (wbot && typeof (wbot as WASocket).chatModify === "function") {
            let webForRead: proto.IWebMessageInfo | null = null;
            for (const row of pendingInbound) {
              const parsed = parseInboundWebMessageInfo(row.dataJson);
              if (
                parsed &&
                (parsed as any).key &&
                (parsed as any).key.fromMe === false
              ) {
                webForRead = parsed;
                break;
              }
            }

            if (webForRead) {
              await (wbot as WASocket).chatModify(
                { markRead: true, lastMessages: [webForRead as any] },
                `${ticket.contact.number}@${
                  ticket.isGroup ? "g.us" : "s.whatsapp.net"
                }`
              );
            } else if (pendingInbound.length > 0) {
              logger.warn(
                `[SetTicketMessagesAsRead] syncWhatsAppReadReceipt: ticket ${ticket.id} tem ${pendingInbound.length} inbound não lidas mas nenhuma com dataJson válido para markRead no WhatsApp`
              );
            }
          }
        }
      }
    }

    await Message.update(
      { read: true },
      {
        where: {
          ticketId: ticket.id,
          read: false
        }
      }
    );
  } catch (err) {
    logger.warn(
      `Could not mark messages as read. Maybe whatsapp session disconnected? Err: ${err}`
    );
  }

  const io = getIO();
  io.to(`company-${ticket.companyId}-mainchannel`).emit(`company-${ticket.companyId}-ticket`, {
    action: "updateUnread",
    ticketId: ticket.id
  });
};

export default SetTicketMessagesAsRead;
