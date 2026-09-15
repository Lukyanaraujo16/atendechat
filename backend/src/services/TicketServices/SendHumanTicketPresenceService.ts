import { jidNormalizedUser } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getTicketRemoteJid } from "../../helpers/GetTicketRemoteJid";
import { isGroupTicket } from "../../helpers/groupTicketRules";
import {
  isInstagramChannelTicket,
  isWhatsappChannelTicket
} from "../../helpers/ticketChannel";
import {
  assertUserCanAccessTicketResource,
  toTicketAccessPayload
} from "../../helpers/ticketAccess";
import { isWhatsAppDisableAllReadAndPresenceSideEffects } from "../../helpers/whatsappUnavailablePresence";
import { getWhatsAppOutboundForTicket } from "../../modules/whatsapp/outbound/resolveWhatsAppOutbound";
import { logger } from "../../utils/logger";
import ShowTicketService from "./ShowTicketService";

export const HUMAN_TICKET_PRESENCE_VALUES = ["composing", "paused"] as const;

export type HumanTicketPresence = (typeof HUMAN_TICKET_PRESENCE_VALUES)[number];

/** Throttle in-memory de composing por atendente+ticket (abuso acidental). */
export const HUMAN_PRESENCE_COMPOSING_THROTTLE_MS = 800;

export type HumanTicketPresenceSkipReason =
  | "instagram"
  | "not_whatsapp"
  | "group"
  | "not_open"
  | "no_connection"
  | "no_jid"
  | "presence_disabled"
  | "throttled"
  | "provider_error";

export type SendHumanTicketPresenceResult = {
  sent: boolean;
  skipped?: HumanTicketPresenceSkipReason;
};

type Actor = {
  id: string | number;
  profile?: string;
  supportMode?: boolean;
};

type Request = {
  ticketId: number;
  companyId: number;
  actor: Actor;
  presence: unknown;
};

const composingThrottleAt = new Map<string, number>();

export function resetHumanPresenceThrottleForTests(): void {
  composingThrottleAt.clear();
}

function isHumanTicketPresence(value: unknown): value is HumanTicketPresence {
  return value === "composing" || value === "paused";
}

function throttleKey(
  companyId: number,
  ticketId: number,
  actorId: unknown
): string {
  return `${companyId}:${ticketId}:${String(actorId)}`;
}

function resolveChatJidFromContact(ticket: {
  contact?: { number?: string | null } | null;
}): string | null {
  const destNumber = String(ticket.contact?.number || "").replace(/\D/g, "");
  if (!destNumber) return null;
  return `${destNumber}@s.whatsapp.net`;
}

function logHumanPresence(fields: Record<string, unknown>): void {
  logger.info(
    {
      event: "whatsapp.human_presence",
      companyId: fields.companyId ?? null,
      ticketId: fields.ticketId ?? null,
      presence: fields.presence ?? null,
      sent: fields.sent ?? false,
      skipped: fields.skipped ?? null
    },
    "[WhatsAppPresence] human"
  );
}

const SendHumanTicketPresenceService = async ({
  ticketId,
  companyId,
  actor,
  presence
}: Request): Promise<SendHumanTicketPresenceResult> => {
  if (!isHumanTicketPresence(presence)) {
    throw new AppError("ERR_INVALID_PRESENCE", 400);
  }

  const ticket = await ShowTicketService(ticketId, companyId);

  await assertUserCanAccessTicketResource(
    actor,
    toTicketAccessPayload(ticket),
    companyId
  );

  const skip = (
    reason: HumanTicketPresenceSkipReason
  ): SendHumanTicketPresenceResult => {
    logHumanPresence({
      companyId,
      ticketId: ticket.id,
      presence,
      sent: false,
      skipped: reason
    });
    return { sent: false, skipped: reason };
  };

  if (isInstagramChannelTicket(ticket)) {
    return skip("instagram");
  }

  if (!isWhatsappChannelTicket(ticket)) {
    return skip("not_whatsapp");
  }

  if (isGroupTicket(ticket)) {
    return skip("group");
  }

  if (String(ticket.status || "") !== "open") {
    return skip("not_open");
  }

  if (ticket.whatsappId == null || ticket.whatsappId === undefined) {
    return skip("no_connection");
  }

  if (isWhatsAppDisableAllReadAndPresenceSideEffects()) {
    return skip("presence_disabled");
  }

  const key = throttleKey(companyId, ticket.id, actor.id);
  const now = Date.now();
  if (presence === "paused") {
    composingThrottleAt.delete(key);
  } else {
    const last = composingThrottleAt.get(key);
    if (last != null && now - last < HUMAN_PRESENCE_COMPOSING_THROTTLE_MS) {
      return skip("throttled");
    }
    composingThrottleAt.set(key, now);
  }

  let remoteJid: string | null = null;
  try {
    remoteJid = await getTicketRemoteJid(ticket);
  } catch (err) {
    logger.warn(
      {
        event: "whatsapp.human_presence_failed",
        companyId,
        ticketId: ticket.id,
        presence,
        result: String((err as Error)?.message || err || "jid_error").slice(
          0,
          80
        )
      },
      "[WhatsAppPresence] human jid failed"
    );
    return skip("no_jid");
  }

  const jidSource = remoteJid || resolveChatJidFromContact(ticket);
  if (!jidSource) {
    return skip("no_jid");
  }

  let jid = jidSource;
  try {
    jid = jidSource.includes("@") ? jidNormalizedUser(jidSource) : jidSource;
  } catch {
    return skip("no_jid");
  }

  try {
    const outbound = await getWhatsAppOutboundForTicket(ticket);
    const sent = await outbound.sendPresence({
      jid,
      presence,
      subscribe: presence === "composing"
    });
    logHumanPresence({
      companyId,
      ticketId: ticket.id,
      presence,
      sent: Boolean(sent),
      skipped: sent ? null : "provider_error"
    });
    if (!sent) {
      return { sent: false, skipped: "provider_error" };
    }
    return { sent: true };
  } catch (err) {
    logger.warn(
      {
        event: "whatsapp.human_presence_failed",
        companyId,
        ticketId: ticket.id,
        presence,
        result: String(
          (err as Error)?.message || err || "presence_error"
        ).slice(0, 80)
      },
      "[WhatsAppPresence] human failed"
    );
    return { sent: false, skipped: "provider_error" };
  }
};

export default SendHumanTicketPresenceService;
