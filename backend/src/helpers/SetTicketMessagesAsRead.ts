import { proto, WASocket } from "@whiskeysockets/baileys";
import type { WAMessageKey } from "@whiskeysockets/baileys/lib/Types/Message.js";
// import cacheLayer from "../libs/cache";
import { getIO } from "../libs/socket";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import GetTicketWbot from "./GetTicketWbot";

const READ_LOG_PREFIX = "[ReadReceipt]";

/**
 * Por omissão usamos `readMessages` (menos agressivo no ecossistema multi-device):
 * reduz o efeito de “já li noutro dispositivo ligado”, que costuma **silenciar
 * notificações push no telefone** da mesma conta.
 *
 * Para voltar ao comportamento anterior (recibo `read` explícito ao interlocutor),
 * defina `WHATSAPP_READ_RECEIPT_PEER_VISIBLE=true` — usa `sendReceipts(keys, "read")`
 * quando disponível.
 *
 * `WHATSAPP_READ_RECEIPT_RESPECT_PRIVACY=true` continua a forçar apenas `readMessages`
 * (ignora PEER_VISIBLE).
 */
function forcePrivacyOnlyReadReceipt(): boolean {
  return process.env.WHATSAPP_READ_RECEIPT_RESPECT_PRIVACY === "true";
}

function wantsPeerVisibleReadReceipt(): boolean {
  if (forcePrivacyOnlyReadReceipt()) {
    return false;
  }
  return process.env.WHATSAPP_READ_RECEIPT_PEER_VISIBLE === "true";
}

/**
 * Opções para {@link SetTicketMessagesAsRead}.
 *
 * `syncWhatsAppReadReceipt: true` só deve ser usado quando um atendente humano
 * está visualizando a conversa no painel (ex.: GET da lista paginada de mensagens do ticket).
 * Fluxos automáticos (webhook, fila, API de mensagens, etc.) devem omitir ou passar `false`.
 */
export type SetTicketMessagesAsReadOptions = {
  syncWhatsAppReadReceipt?: boolean;
  /** Só para logs [ReadReceipt]: motivo da tentativa de sync com o WhatsApp. */
  readReceiptReason?: string;
};

/** GET `/messages/:ticketId` — atendente abriu/carregou a conversa no painel. */
export const HUMAN_PANEL_LIST_MESSAGES: SetTicketMessagesAsReadOptions = {
  syncWhatsAppReadReceipt: true,
  readReceiptReason: "panel_GET_messages_list"
};

/** POST `/messages/:ticketId` — atendente enviou mensagem pelo painel. */
export const HUMAN_PANEL_SEND_MESSAGE: SetTicketMessagesAsReadOptions = {
  syncWhatsAppReadReceipt: true,
  readReceiptReason: "panel_POST_send_message"
};

/**
 * @deprecated Preferir {@link HUMAN_PANEL_LIST_MESSAGES} ou {@link HUMAN_PANEL_SEND_MESSAGE}
 * para logs com motivo explícito.
 */
export const HUMAN_PANEL_CONVERSATION_VIEW_WHATSAPP_READ: SetTicketMessagesAsReadOptions =
  {
    syncWhatsAppReadReceipt: true,
    readReceiptReason: "panel_unspecified"
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

function buildFallbackRemoteJid(ticket: Ticket): string {
  const num = ticket.contact?.number?.replace(/\D/g, "");
  if (!num) return "";
  const suffix = ticket.isGroup ? "g.us" : "s.whatsapp.net";
  return `${num}@${suffix}`;
}

/** Monta chaves WAMessageKey para recibos de leitura (inbound apenas). */
function buildReadKeysFromRows(rows: Message[], ticket: Ticket): WAMessageKey[] {
  const fallbackJid = buildFallbackRemoteJid(ticket);
  const seen = new Set<string>();
  const keys: WAMessageKey[] = [];

  for (const row of rows) {
    const parsed = parseInboundWebMessageInfo(row.dataJson);
    const key = parsed?.key;
    const fromMe =
      key?.fromMe === true ? true : key?.fromMe === false ? false : false;
    if (fromMe) {
      continue;
    }

    const id = (key?.id || row.id || "").trim();
    const remoteJid = (key?.remoteJid || row.remoteJid || fallbackJid || "").trim();
    if (!id || !remoteJid) {
      continue;
    }

    const participant =
      key?.participant || row.participant || undefined;
    const dedupe = `${remoteJid}|${id}|${participant || ""}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const waKey: WAMessageKey = {
      remoteJid,
      id,
      fromMe: false
    };
    if (participant) {
      waKey.participant = participant;
    }
    keys.push(waKey);
  }

  return keys;
}

async function ensureTicketWithContact(ticket: Ticket): Promise<Ticket> {
  if (ticket.contact?.number) {
    return ticket;
  }
  const full = await Ticket.findByPk(ticket.id, {
    include: [{ model: Contact, as: "contact" }]
  });
  return full || ticket;
}

type WbotReceipts = WASocket;

async function sendWhatsAppReadReceipts(
  wbot: WbotReceipts,
  keys: WAMessageKey[],
  meta: {
    companyId: number;
    whatsappId: number;
    ticketId: number;
    readReceiptReason: string;
  }
): Promise<void> {
  if (keys.length === 0) return;

  const sample = keys.slice(0, 3).map((k) => ({
    remoteJid: k.remoteJid,
    id: k.id,
    fromMe: k.fromMe,
    participant: k.participant || null
  }));

  const peerVisible = wantsPeerVisibleReadReceipt();

  if (peerVisible && typeof wbot.sendReceipts === "function") {
    logger.info(
      `${READ_LOG_PREFIX} whatsapp_send reason=${meta.readReceiptReason} strategy=sendReceipts(read) companyId=${meta.companyId} whatsappId=${meta.whatsappId} ticketId=${meta.ticketId} keyCount=${keys.length} sample=${JSON.stringify(sample)}`
    );
    await wbot.sendReceipts(keys, "read");
    logger.info(
      `${READ_LOG_PREFIX} success reason=${meta.readReceiptReason} strategy=sendReceipts(read) companyId=${meta.companyId} whatsappId=${meta.whatsappId} ticketId=${meta.ticketId}`
    );
    return;
  }

  if (typeof wbot.readMessages === "function") {
    logger.info(
      `${READ_LOG_PREFIX} whatsapp_send reason=${meta.readReceiptReason} strategy=readMessages companyId=${meta.companyId} whatsappId=${meta.whatsappId} ticketId=${meta.ticketId} keyCount=${keys.length} peerVisibleEnv=${peerVisible} sample=${JSON.stringify(sample)}`
    );
    await wbot.readMessages(keys);
    logger.info(
      `${READ_LOG_PREFIX} success reason=${meta.readReceiptReason} strategy=readMessages companyId=${meta.companyId} whatsappId=${meta.whatsappId} ticketId=${meta.ticketId}`
    );
    return;
  }

  if (typeof wbot.sendReceipts === "function") {
    logger.warn(
      `${READ_LOG_PREFIX} whatsapp_send reason=${meta.readReceiptReason} readMessages missing; fallback sendReceipts(read) companyId=${meta.companyId} whatsappId=${meta.whatsappId} ticketId=${meta.ticketId}`
    );
    await wbot.sendReceipts(keys, "read");
    logger.info(
      `${READ_LOG_PREFIX} success reason=${meta.readReceiptReason} strategy=sendReceipts(fallback) companyId=${meta.companyId} whatsappId=${meta.whatsappId} ticketId=${meta.ticketId}`
    );
  }
}

/**
 * Zera não lidas no ticket, marca mensagens como lidas no banco e notifica o socket.
 * Opcionalmente envia recibos de leitura ao WhatsApp — apenas quando
 * `syncWhatsAppReadReceipt` for true e a conexão tiver `autoReadMessages` ativo.
 *
 * Baileys v7: `chatModify({ markRead })` costuma não refletir bem no telefone.
 * Por omissão: `readMessages`; recibo visível ao cliente só com
 * `WHATSAPP_READ_RECEIPT_PEER_VISIBLE=true`.
 */
const SetTicketMessagesAsRead = async (
  ticket: Ticket,
  options: SetTicketMessagesAsReadOptions = {}
): Promise<void> => {
  const { syncWhatsAppReadReceipt = false, readReceiptReason } = options;
  const receiptReason = readReceiptReason ?? "unspecified";

  await ticket.update({ unreadMessages: 0 });
  // await cacheLayer.set(`contacts:${ticket.contactId}:unreads`, "0");

  try {
    if (syncWhatsAppReadReceipt) {
      logger.info(
        `${READ_LOG_PREFIX} intent reason=${receiptReason} ticketId=${ticket.id} companyId=${ticket.companyId} whatsappId=${ticket.whatsappId} (syncWhatsAppReadReceipt=true; só envia ao WA se houver pendentes e autoReadMessages)`
      );

      const pendingInbound = await Message.findAll({
        where: {
          ticketId: ticket.id,
          fromMe: false,
          read: false
        },
        attributes: ["id", "dataJson", "remoteJid", "participant"],
        order: [["createdAt", "ASC"]]
      });

      if (pendingInbound.length === 0) {
        logger.info(
          `${READ_LOG_PREFIX} skip reason=${receiptReason} cause=no_pending_inbound_unread ticketId=${ticket.id} whatsappId=${ticket.whatsappId}`
        );
      } else {
        const whatsapp = await Whatsapp.findByPk(ticket.whatsappId, {
          attributes: ["autoReadMessages"]
        });
        const allowWhatsAppReceipt =
          whatsapp ? whatsapp.autoReadMessages !== false : true;

        if (allowWhatsAppReceipt) {
          const ticketScoped = await ensureTicketWithContact(ticket);
          const keys = buildReadKeysFromRows(pendingInbound, ticketScoped);

          if (keys.length === 0) {
            logger.warn(
              `${READ_LOG_PREFIX} skip reason=${receiptReason} cause=no_valid_keys ticketId=${ticket.id} companyId=${ticket.companyId} whatsappId=${ticket.whatsappId} pendingRows=${pendingInbound.length}`
            );
          } else {
            const wbot = await GetTicketWbot(ticket);
            if (!wbot) {
              logger.warn(
                `${READ_LOG_PREFIX} skip reason=${receiptReason} cause=no_wbot ticketId=${ticket.id} whatsappId=${ticket.whatsappId}`
              );
            } else {
              try {
                await sendWhatsAppReadReceipts(wbot as WbotReceipts, keys, {
                  companyId: ticket.companyId,
                  whatsappId: ticket.whatsappId,
                  ticketId: ticket.id,
                  readReceiptReason: receiptReason
                });
              } catch (receiptErr) {
                logger.warn(
                  `${READ_LOG_PREFIX} error reason=${receiptReason} ticketId=${ticket.id} companyId=${ticket.companyId} whatsappId=${ticket.whatsappId} err=${receiptErr instanceof Error ? receiptErr.message : String(receiptErr)}`
                );
              }
            }
          }
        } else {
          logger.info(
            `${READ_LOG_PREFIX} skip reason=${receiptReason} cause=autoReadMessages_disabled ticketId=${ticket.id} whatsappId=${ticket.whatsappId}`
          );
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
