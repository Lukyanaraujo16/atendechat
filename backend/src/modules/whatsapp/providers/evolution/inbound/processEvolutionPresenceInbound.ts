import Whatsapp from "../../../../../models/Whatsapp";
import { logger } from "../../../../../utils/logger";
import { dispatchHumanInboundTicketPresence } from "../../../inbound/dispatchHumanInboundTicketPresence";
import { adaptEvolutionInboundPresence } from "./adaptEvolutionInboundPresence";
import { EvolutionWebhookEnvelope } from "./evolutionWebhookTypes";

type PresenceWebhookResult = {
  outcome: "processed" | "skipped";
  reason?: string;
  ticketId?: number;
};

export async function processEvolutionPresenceInbound(input: {
  whatsapp: Whatsapp;
  envelope: EvolutionWebhookEnvelope;
}): Promise<PresenceWebhookResult> {
  const { whatsapp, envelope } = input;
  const adapted = adaptEvolutionInboundPresence({ envelope });

  if (adapted.ok === false) {
    logger.info(
      {
        event: "whatsapp.inbound_presence",
        companyId: whatsapp.companyId,
        whatsappId: whatsapp.id,
        sent: false,
        skipped: adapted.reason
      },
      "[WhatsAppPresence] inbound skip"
    );
    return { outcome: "skipped", reason: adapted.reason };
  }

  try {
    const dispatched = await dispatchHumanInboundTicketPresence({
      companyId: whatsapp.companyId,
      whatsappId: whatsapp.id,
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
        companyId: whatsapp.companyId,
        whatsappId: whatsapp.id,
        result: String((err as Error)?.message || err).slice(0, 80)
      },
      "[WhatsAppPresence] inbound failed"
    );
    return { outcome: "skipped", reason: "presence_error" };
  }
}
