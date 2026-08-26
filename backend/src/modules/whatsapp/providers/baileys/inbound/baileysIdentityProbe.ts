import type { WASocket } from "@whiskeysockets/baileys";
import { logger } from "../../../../../utils/logger";
import { normalizeWhatsAppJidToNumber } from "../../../../../helpers/normalizeWhatsAppJidToNumber";
import type { NormalizedWhatsAppMessage } from "../../../inbound/NormalizedWhatsAppMessage";

export type WhatsAppIdentityProbe = (jid: string) => Promise<string | null>;

/**
 * Probe Baileys-specific (onWhatsApp). Domínio não deve chamar wbot.onWhatsApp.
 */
export function createBaileysIdentityProbe(
  wbot: WASocket
): WhatsAppIdentityProbe {
  return async (jid: string): Promise<string | null> => {
    try {
      const results = await wbot.onWhatsApp(jid);
      const first = Array.isArray(results) ? results[0] : results;
      if (first?.exists && first?.jid) {
        return normalizeWhatsAppJidToNumber(first.jid);
      }
    } catch (probeErr) {
      logger.debug(
        { err: probeErr, jid },
        "[ContactNormalization] onWhatsApp probe failed"
      );
    }
    return null;
  };
}

/**
 * Shape mínimo compatível com resolveInboundContactFromMessage /
 * extractInboundJidMeta a partir do DTO normalizado (sem proto completo).
 */
export function inboundAddressingAsMsgLike(
  inbound: Pick<
    NormalizedWhatsAppMessage,
    "messageId" | "fromMe" | "pushName" | "addressing" | "isGroup"
  >
): {
  key: {
    id: string;
    remoteJid: string;
    participant: string;
    fromMe: boolean;
    senderPn?: string;
    remoteJidAlt?: string;
    participantPn?: string;
  };
  pushName: string | null;
} {
  return {
    key: {
      id: inbound.messageId,
      remoteJid: inbound.addressing.remoteJid,
      participant: inbound.addressing.participant,
      fromMe: inbound.fromMe,
      senderPn: inbound.addressing.senderPn,
      remoteJidAlt: inbound.addressing.remoteJidAlt,
      participantPn: inbound.addressing.participantPn
    },
    pushName: inbound.pushName
  };
}
