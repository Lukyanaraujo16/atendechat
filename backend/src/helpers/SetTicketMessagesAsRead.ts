import type { WAMessageKey } from "@whiskeysockets/baileys/lib/Types/Message.js";
import { cacheLayer } from "../libs/cache";
import { getIO } from "../libs/socket";
import Contact from "../models/Contact";
import Message from "../models/Message";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import { logger } from "../utils/logger";
import { getWhatsAppOutboundForTicket } from "../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import { isWhatsAppDisableAllReadAndPresenceSideEffects } from "./whatsappUnavailablePresence";

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

/** `Messages.dataJson` é TEXT com JSON stringificado; normaliza para objeto. */
function parseDataJsonObject(
  raw: string | null | undefined
): Record<string, unknown> | null {
  if (raw == null || raw === "") {
    return null;
  }
  try {
    let parsed: unknown;
    if (typeof raw === "string") {
      parsed = JSON.parse(raw);
    } else {
      parsed = JSON.parse(JSON.stringify(raw));
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickStringId(...candidates: unknown[]): string {
  const found = candidates.find(
    c => typeof c === "string" && String(c).trim().length > 0
  );
  return found != null ? String(found).trim() : "";
}

function resolveFromMe(
  fromMeHint: boolean | null,
  key: Record<string, unknown> | null
): boolean {
  if (fromMeHint === true) return true;
  if (fromMeHint === false) return false;
  return key?.fromMe === true;
}

/**
 * Extrai chave de leitura de dataJson Baileys (key no root) ou Evolution
 * ({ provider, payload: { key } | envelope.data.key | keyId }).
 */
function extractReadKeyFields(
  row: Message,
  fallbackJid: string
): {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
} | null {
  const parsed = parseDataJsonObject(row.dataJson);
  let key: Record<string, unknown> | null = null;
  let fromMeHint: boolean | null = null;

  if (parsed?.provider === "evolution") {
    const payload = asRecord(parsed.payload);
    key = asRecord(payload?.key);
    if (!key) {
      const data = asRecord(payload?.data);
      key = asRecord(data?.key);
      if (!key && data) {
        const id = pickStringId(data.keyId, data.id);
        if (id) {
          key = {
            id,
            remoteJid: data.remoteJid,
            fromMe: data.fromMe,
            participant: data.participant
          };
        }
      }
    }
    if (typeof key?.fromMe === "boolean") {
      fromMeHint = key.fromMe;
    }
  } else {
    key = asRecord(parsed?.key) || asRecord(parsed);
  }

  if (resolveFromMe(fromMeHint, key)) {
    return null;
  }

  const id = String(key?.id || row.id || "").trim();
  const remoteJid = String(
    key?.remoteJid || row.remoteJid || fallbackJid || ""
  ).trim();
  if (!id || !remoteJid) {
    return null;
  }

  let participant: string | undefined;
  if (key?.participant) {
    participant = String(key.participant);
  } else if (row.participant) {
    participant = String(row.participant);
  }

  return { id, remoteJid, fromMe: false, participant };
}

function buildFallbackRemoteJid(ticket: Ticket): string {
  const num = ticket.contact?.number?.replace(/\D/g, "");
  if (!num) return "";
  const suffix = ticket.isGroup ? "g.us" : "s.whatsapp.net";
  return `${num}@${suffix}`;
}

/** Monta chaves para recibos de leitura (inbound apenas). */
function buildReadKeysFromRows(
  rows: Message[],
  ticket: Ticket
): WAMessageKey[] {
  const fallbackJid = buildFallbackRemoteJid(ticket);
  const seen = new Set<string>();
  const keys: WAMessageKey[] = [];

  rows.forEach(row => {
    const extracted = extractReadKeyFields(row, fallbackJid);
    if (!extracted) {
      return;
    }

    const dedupe = `${extracted.remoteJid}|${extracted.id}|${
      extracted.participant || ""
    }`;
    if (seen.has(dedupe)) {
      return;
    }
    seen.add(dedupe);

    const waKey: WAMessageKey = {
      remoteJid: extracted.remoteJid,
      id: extracted.id,
      fromMe: false
    };
    if (extracted.participant) {
      waKey.participant = extracted.participant;
    }
    keys.push(waKey);
  });

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

async function sendWhatsAppReadReceipts(
  outbound: {
    markAsRead: (
      readKeys: Array<{
        remoteJid: string;
        id: string;
        fromMe: boolean;
        participant?: string;
      }>
    ) => Promise<void>;
  },
  keys: WAMessageKey[],
  meta: {
    companyId: number;
    whatsappId: number;
    ticketId: number;
    readReceiptReason: string;
  }
): Promise<void> {
  if (keys.length === 0) return;

  const sample = keys.slice(0, 3).map(k => ({
    remoteJid: k.remoteJid,
    id: k.id,
    fromMe: k.fromMe,
    participant: k.participant || null
  }));

  const peerVisible = wantsPeerVisibleReadReceipt();
  const strategy = peerVisible ? "sendReceipts(read)" : "readMessages";

  logger.info(
    `${READ_LOG_PREFIX} whatsapp_send reason=${
      meta.readReceiptReason
    } strategy=${strategy} companyId=${meta.companyId} whatsappId=${
      meta.whatsappId
    } ticketId=${meta.ticketId} keyCount=${
      keys.length
    } peerVisibleEnv=${peerVisible} sample=${JSON.stringify(sample)}`
  );
  await outbound.markAsRead(
    keys.map(k => ({
      remoteJid: String(k.remoteJid || ""),
      id: String(k.id || ""),
      fromMe: Boolean(k.fromMe),
      ...(k.participant ? { participant: String(k.participant) } : {})
    }))
  );
  logger.info(
    `${READ_LOG_PREFIX} success reason=${meta.readReceiptReason} strategy=${strategy} companyId=${meta.companyId} whatsappId=${meta.whatsappId} ticketId=${meta.ticketId}`
  );
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
  const unreadCacheContactId = ticket.contactId ?? ticket.contact?.id;
  if (unreadCacheContactId != null) {
    try {
      await cacheLayer.set(`contacts:${unreadCacheContactId}:unreads`, "0");
    } catch (err) {
      logger.warn(
        `Could not reset unread cache for contact ${unreadCacheContactId}. Err: ${err}`
      );
    }
  }

  try {
    if (syncWhatsAppReadReceipt) {
      if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
        logger.info(
          `${READ_LOG_PREFIX} skip_whatsapp_sync reason=${receiptReason} cause=WHATSAPP_DISABLE_ALL_READ_AND_PRESENCE_SIDE_EFFECTS ticketId=${ticket.id} companyId=${ticket.companyId} whatsappId=${ticket.whatsappId} (DB continua a marcar read abaixo; sem readMessages/sendReceipts)`
        );
      } else {
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
          const allowWhatsAppReceipt = whatsapp
            ? whatsapp.autoReadMessages !== false
            : true;

          if (allowWhatsAppReceipt) {
            const ticketScoped = await ensureTicketWithContact(ticket);
            const keys = buildReadKeysFromRows(pendingInbound, ticketScoped);

            if (keys.length === 0) {
              logger.warn(
                `${READ_LOG_PREFIX} skip reason=${receiptReason} cause=no_valid_keys ticketId=${ticket.id} companyId=${ticket.companyId} whatsappId=${ticket.whatsappId} pendingRows=${pendingInbound.length}`
              );
            } else {
              const outbound = await getWhatsAppOutboundForTicket(ticket);
              if (!outbound) {
                logger.warn(
                  `${READ_LOG_PREFIX} skip reason=${receiptReason} cause=no_wbot ticketId=${ticket.id} whatsappId=${ticket.whatsappId}`
                );
              } else {
                try {
                  await sendWhatsAppReadReceipts(outbound, keys, {
                    companyId: ticket.companyId,
                    whatsappId: ticket.whatsappId,
                    ticketId: ticket.id,
                    readReceiptReason: receiptReason
                  });
                } catch (receiptErr) {
                  logger.warn(
                    `${READ_LOG_PREFIX} error reason=${receiptReason} ticketId=${
                      ticket.id
                    } companyId=${ticket.companyId} whatsappId=${
                      ticket.whatsappId
                    } err=${
                      receiptErr instanceof Error
                        ? receiptErr.message
                        : String(receiptErr)
                    }`
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
  io.to(`company-${ticket.companyId}-mainchannel`).emit(
    `company-${ticket.companyId}-ticket`,
    {
      action: "updateUnread",
      ticketId: ticket.id
    }
  );
};

export default SetTicketMessagesAsRead;
