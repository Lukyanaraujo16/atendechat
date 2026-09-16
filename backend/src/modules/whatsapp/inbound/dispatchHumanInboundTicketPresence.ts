import { Op } from "sequelize";
import Contact from "../../../models/Contact";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import { getIO } from "../../../libs/socket";
import { logger } from "../../../utils/logger";

export type HumanWhatsAppInboundPresence = "composing" | "paused" | "recording";

export const HUMAN_INBOUND_PRESENCE_HEARTBEAT_MS = 3000;
export const HUMAN_INBOUND_PRESENCE_ENTRY_TTL_MS = 30000;

type ThrottleEntry = {
  presence: HumanWhatsAppInboundPresence;
  emittedAt: number;
};

const throttleByChat = new Map<string, ThrottleEntry>();

export type HumanInboundTicketPresenceInput = {
  companyId: number;
  whatsappId: number;
  remoteJid: string;
  presence: HumanWhatsAppInboundPresence;
};

export type DispatchHumanInboundPresenceResult = {
  emitted: boolean;
  skipped?: string;
  ticketId?: number;
};

export function resetHumanInboundPresenceThrottleForTests(): void {
  throttleByChat.clear();
}

function throttleKey(whatsappId: number, remoteJid: string): string {
  return `${whatsappId}:${remoteJid}`;
}

function pruneThrottle(now: number): void {
  throttleByChat.forEach((entry, key) => {
    if (now - entry.emittedAt > HUMAN_INBOUND_PRESENCE_ENTRY_TTL_MS) {
      throttleByChat.delete(key);
    }
  });
}

export function shouldEmitHumanInboundPresence(input: {
  whatsappId: number;
  remoteJid: string;
  presence: HumanWhatsAppInboundPresence;
  now?: number;
}): boolean {
  const now = input.now ?? Date.now();
  pruneThrottle(now);
  const key = throttleKey(input.whatsappId, input.remoteJid);
  const prev = throttleByChat.get(key);
  if (!prev) {
    throttleByChat.set(key, { presence: input.presence, emittedAt: now });
    return true;
  }
  if (prev.presence !== input.presence) {
    throttleByChat.set(key, { presence: input.presence, emittedAt: now });
    return true;
  }
  if (input.presence === "paused") {
    return false;
  }
  if (now - prev.emittedAt >= HUMAN_INBOUND_PRESENCE_HEARTBEAT_MS) {
    throttleByChat.set(key, { presence: input.presence, emittedAt: now });
    return true;
  }
  return false;
}

function digitsFromJid(jid: string): string {
  return String(jid).trim().split("@")[0].split(":")[0].replace(/\D/g, "");
}

async function findEligibleTicket(input: {
  companyId: number;
  whatsappId: number;
  remoteJid: string;
}): Promise<Ticket | null> {
  const { companyId, whatsappId, remoteJid } = input;
  const number = digitsFromJid(remoteJid);

  let contactId: number | null = null;
  if (number) {
    const contact = await Contact.findOne({
      where: {
        companyId,
        whatsappId,
        number,
        isGroup: false
      },
      attributes: ["id"]
    });
    if (contact) {
      contactId = contact.id;
    }
  }

  if (contactId) {
    const ticket = await Ticket.findOne({
      where: {
        companyId,
        whatsappId,
        contactId,
        status: { [Op.in]: ["open", "pending"] }
      },
      order: [
        ["updatedAt", "DESC"],
        ["id", "DESC"]
      ]
    });
    if (ticket) return ticket;
  }

  const lastMsg = await Message.findOne({
    where: { companyId, remoteJid },
    order: [["createdAt", "DESC"]],
    attributes: ["ticketId"]
  });
  if (!lastMsg?.ticketId) {
    return null;
  }

  const byMessage = await Ticket.findOne({
    where: {
      id: lastMsg.ticketId,
      companyId,
      whatsappId,
      status: { [Op.in]: ["open", "pending"] }
    }
  });
  return byMessage;
}

/**
 * Domínio provider-agnostic: localiza ticket existente e emite Socket.
 * Não cria Contact/Ticket/Message. Sem `provider` no contrato.
 */
export async function dispatchHumanInboundTicketPresence(
  input: HumanInboundTicketPresenceInput
): Promise<DispatchHumanInboundPresenceResult> {
  const { companyId, whatsappId, remoteJid, presence } = input;

  if (!shouldEmitHumanInboundPresence({ whatsappId, remoteJid, presence })) {
    return { emitted: false, skipped: "throttled" };
  }

  let ticket: Ticket | null = null;
  try {
    ticket = await findEligibleTicket({ companyId, whatsappId, remoteJid });
  } catch (err) {
    logger.warn(
      {
        event: "whatsapp.inbound_presence_lookup_failed",
        companyId,
        whatsappId,
        presence,
        result: String((err as Error)?.message || err).slice(0, 80)
      },
      "[WhatsAppPresence] inbound lookup failed"
    );
    return { emitted: false, skipped: "lookup_error" };
  }

  if (!ticket) {
    logger.info(
      {
        event: "whatsapp.inbound_presence",
        companyId,
        whatsappId,
        presence,
        sent: false,
        skipped: "no_ticket"
      },
      "[WhatsAppPresence] inbound"
    );
    return { emitted: false, skipped: "no_ticket" };
  }

  try {
    const io = getIO();
    io.to(String(ticket.id)).emit(`company-${companyId}-ticketPresence`, {
      ticketId: ticket.id,
      presence
    });
  } catch (err) {
    logger.warn(
      {
        event: "whatsapp.inbound_presence_socket_failed",
        companyId,
        whatsappId,
        ticketId: ticket.id,
        presence,
        result: String((err as Error)?.message || err).slice(0, 80)
      },
      "[WhatsAppPresence] inbound socket failed"
    );
    return {
      emitted: false,
      skipped: "socket_error",
      ticketId: ticket.id
    };
  }

  logger.info(
    {
      event: "whatsapp.inbound_presence",
      companyId,
      whatsappId,
      ticketId: ticket.id,
      presence,
      sent: true
    },
    "[WhatsAppPresence] inbound"
  );

  return { emitted: true, ticketId: ticket.id };
}
