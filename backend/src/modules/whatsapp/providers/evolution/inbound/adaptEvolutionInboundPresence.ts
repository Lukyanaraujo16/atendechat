import {
  EvolutionPresenceUpdateData,
  EvolutionWebhookEnvelope,
  isEvolutionPresenceUpdateEvent
} from "./evolutionWebhookTypes";
import type { HumanWhatsAppInboundPresence } from "../../../inbound/dispatchHumanInboundTicketPresence";

export type AdaptEvolutionPresenceResult =
  | {
      ok: true;
      remoteJid: string;
      presence: HumanWhatsAppInboundPresence;
    }
  | {
      ok: false;
      reason:
        | "unsupported_event"
        | "malformed"
        | "group"
        | "lid_without_pn"
        | "not_private_jid"
        | "own_presence"
        | "own_jid_unknown"
        | "ignored_presence";
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function jidLocalPart(jid: string): string {
  return String(jid).trim().toLowerCase().split("@")[0].split(":")[0];
}

function jidDigits(jid: string): string {
  return jidLocalPart(jid).replace(/\D/g, "");
}

export function isSameWhatsAppIdentity(a: string, b: string): boolean {
  const left = String(a || "").trim();
  const right = String(b || "").trim();
  if (!left || !right) return false;
  if (jidLocalPart(left) === jidLocalPart(right)) return true;
  const da = jidDigits(left);
  const db = jidDigits(right);
  return da.length >= 10 && da === db;
}

function parsePresence(
  value: unknown
): HumanWhatsAppInboundPresence | "ignored" | null {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (raw === "composing" || raw === "paused" || raw === "recording") {
    return raw;
  }
  if (raw === "available" || raw === "unavailable") {
    return "ignored";
  }
  return null;
}

/**
 * Converte envelope Evolution presence.update em input de domínio.
 * NÃO usa envelope.sender como identidade do cliente.
 */
export function adaptEvolutionInboundPresence(input: {
  envelope: EvolutionWebhookEnvelope;
}): AdaptEvolutionPresenceResult {
  const { envelope } = input;
  const eventType = envelope.event != null ? String(envelope.event).trim() : "";
  if (!isEvolutionPresenceUpdateEvent(eventType)) {
    return { ok: false, reason: "unsupported_event" };
  }

  const data = asRecord(envelope.data) as EvolutionPresenceUpdateData | null;
  if (!data) {
    return { ok: false, reason: "malformed" };
  }

  const chatJid = typeof data.id === "string" ? data.id.trim() : "";
  if (!chatJid) {
    return { ok: false, reason: "malformed" };
  }

  if (chatJid.toLowerCase().endsWith("@g.us")) {
    return { ok: false, reason: "group" };
  }

  if (chatJid.toLowerCase().endsWith("@lid")) {
    return { ok: false, reason: "lid_without_pn" };
  }

  if (!chatJid.toLowerCase().endsWith("@s.whatsapp.net")) {
    return { ok: false, reason: "not_private_jid" };
  }

  const ownJid =
    typeof envelope.sender === "string" ? envelope.sender.trim() : "";
  if (!ownJid) {
    return { ok: false, reason: "own_jid_unknown" };
  }

  if (isSameWhatsAppIdentity(chatJid, ownJid)) {
    return { ok: false, reason: "own_presence" };
  }

  const presences = asRecord(data.presences);
  if (!presences) {
    return { ok: false, reason: "malformed" };
  }

  const remoteEntries: Array<{
    jid: string;
    presence: HumanWhatsAppInboundPresence;
  }> = [];

  Object.entries(presences).forEach(([jid, entry]) => {
    if (isSameWhatsAppIdentity(jid, ownJid)) {
      return;
    }
    const parsed = parsePresence(asRecord(entry)?.lastKnownPresence);
    if (
      parsed === "composing" ||
      parsed === "paused" ||
      parsed === "recording"
    ) {
      remoteEntries.push({ jid, presence: parsed });
    }
  });

  if (remoteEntries.length === 0) {
    const chatEntry = parsePresence(
      asRecord(presences[chatJid])?.lastKnownPresence
    );
    if (chatEntry === "ignored") {
      return { ok: false, reason: "ignored_presence" };
    }
    const anyIgnored = Object.values(presences).some(entry => {
      const parsed = parsePresence(asRecord(entry)?.lastKnownPresence);
      return parsed === "ignored";
    });
    if (anyIgnored) {
      return { ok: false, reason: "ignored_presence" };
    }
    return { ok: false, reason: "own_presence" };
  }

  const matchingChat = remoteEntries.find(e =>
    isSameWhatsAppIdentity(e.jid, chatJid)
  );
  const chosen = matchingChat || remoteEntries[0];
  const chatPresence = parsePresence(
    asRecord(presences[chatJid])?.lastKnownPresence
  );
  if (chatPresence === "ignored" && !matchingChat) {
    return { ok: false, reason: "ignored_presence" };
  }

  return {
    ok: true,
    remoteJid: chatJid,
    presence: chosen.presence
  };
}
