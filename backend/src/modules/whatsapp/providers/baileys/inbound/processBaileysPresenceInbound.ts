import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { logger } from "../../../../../utils/logger";
import { dispatchHumanInboundTicketPresence } from "../../../inbound/dispatchHumanInboundTicketPresence";
import { adaptBaileysInboundPresence } from "./adaptBaileysInboundPresence";

type PresenceInboundResult = {
  outcome: "processed" | "skipped";
  reason?: string;
  ticketId?: number;
};

type BaileysPresenceSocket = {
  id?: number;
  user?: { id?: string } | null;
  ev: {
    on: (event: string, cb: (data: unknown) => void) => void;
  };
};

export function resolveBaileysOwnPresenceJid(
  userId: string | null | undefined
): string | null {
  const raw = typeof userId === "string" ? userId.trim() : "";
  if (!raw) return null;
  try {
    const normalized = jidNormalizedUser(raw);
    return normalized ? String(normalized) : raw;
  } catch {
    return raw;
  }
}

export async function processBaileysPresenceInbound(input: {
  companyId: number;
  whatsappId: number;
  ownJid: string | null;
  event: unknown;
}): Promise<PresenceInboundResult> {
  const { companyId, whatsappId, ownJid, event } = input;
  const adapted = adaptBaileysInboundPresence({ event, ownJid });

  if (adapted.ok === false) {
    logger.info(
      {
        event: "whatsapp.inbound_presence",
        companyId,
        whatsappId,
        sent: false,
        skipped: adapted.reason
      },
      "[WhatsAppPresence] inbound skip"
    );
    return { outcome: "skipped", reason: adapted.reason };
  }

  try {
    const dispatched = await dispatchHumanInboundTicketPresence({
      companyId,
      whatsappId,
      remoteJid: adapted.remoteJid,
      presence: adapted.presence
    });
    if (!dispatched.emitted) {
      return {
        outcome: "skipped",
        reason: dispatched.skipped,
        ticketId: dispatched.ticketId
      };
    }
    return {
      outcome: "processed",
      reason: adapted.presence,
      ticketId: dispatched.ticketId
    };
  } catch (err) {
    logger.warn(
      {
        event: "whatsapp.inbound_presence_failed",
        companyId,
        whatsappId,
        result: String((err as Error)?.message || err).slice(0, 80)
      },
      "[WhatsAppPresence] inbound failed"
    );
    return { outcome: "skipped", reason: "presence_error" };
  }
}

/**
 * Uma inscrição por socket. StartWhatsAppSession cria socket novo no reconnect.
 */
export function registerBaileysInboundPresenceListener(
  wbot: BaileysPresenceSocket,
  input: { companyId: number }
): void {
  const whatsappId = wbot.id ?? 0;
  wbot.ev.on("presence.update", (event: unknown) => {
    processBaileysPresenceInbound({
      companyId: input.companyId,
      whatsappId,
      ownJid: resolveBaileysOwnPresenceJid(wbot.user?.id),
      event
    }).catch(err => {
      logger.warn(
        {
          event: "whatsapp.inbound_presence_failed",
          companyId: input.companyId,
          whatsappId,
          result: String((err as Error)?.message || err).slice(0, 80)
        },
        "[WhatsAppPresence] inbound baileys listener"
      );
    });
  });
}
