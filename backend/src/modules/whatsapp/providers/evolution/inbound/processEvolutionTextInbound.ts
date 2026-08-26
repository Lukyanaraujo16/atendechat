import Contact from "../../../../../models/Contact";
import Message from "../../../../../models/Message";
import Ticket from "../../../../../models/Ticket";
import Whatsapp from "../../../../../models/Whatsapp";
import CreateOrUpdateContactService from "../../../../../services/ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../../../../../services/TicketServices/FindOrCreateTicketService";
import { classifyInboundMessageFromNormalized } from "../../../../../services/AiAgentService/classifyInboundMessage";
import { logger } from "../../../../../utils/logger";
import { NormalizedWhatsAppMessage } from "../../../inbound/NormalizedWhatsAppMessage";
import { processInboundWhatsAppMessage } from "../../../inbound/ProcessInboundWhatsAppMessage";
import { resolveQuotedMessageByStanzaId } from "../../../inbound/resolveQuotedMessageByStanzaId";
import { createEvolutionInboundMessage } from "./createEvolutionInboundMessage";

export type ProcessEvolutionTextResult =
  | { status: "created"; messageId: string; ticketId: number }
  | { status: "duplicate"; messageId: string }
  | { status: "skipped"; reason: string };

async function isDuplicateEvolutionMessage(
  companyId: number,
  messageId: string
): Promise<boolean> {
  const byExternal = await Message.findOne({
    where: { companyId, externalMessageId: messageId },
    attributes: ["id"]
  });
  if (byExternal) return true;
  const byId = await Message.findByPk(messageId, { attributes: ["id"] });
  return Boolean(byId);
}

/**
 * Domínio provider-agnostic para texto Evolution.
 * Sem WASocket / GetTicketWbot / raw Baileys / outbound.
 */
export async function processEvolutionTextInbound(input: {
  inbound: NormalizedWhatsAppMessage;
  whatsapp: Whatsapp;
  evolutionPayloadSanitized: Record<string, unknown>;
}): Promise<ProcessEvolutionTextResult> {
  const { inbound, whatsapp, evolutionPayloadSanitized } = input;
  let result: ProcessEvolutionTextResult = {
    status: "skipped",
    reason: "no_result"
  };

  await processInboundWhatsAppMessage(inbound, {
    handleInboundMessage: async dto => {
      if (dto.provider !== "evolution") {
        throw new Error("ERR_EVOLUTION_HANDLER_PROVIDER_MISMATCH");
      }
      if (dto.rawProviderMessage != null) {
        throw new Error("ERR_EVOLUTION_MUST_NOT_CARRY_BAILEYS_RAW");
      }

      if (await isDuplicateEvolutionMessage(dto.companyId, dto.messageId)) {
        result = { status: "duplicate", messageId: dto.messageId };
        return;
      }

      if (!dto.senderNumber && !dto.isGroup) {
        result = { status: "skipped", reason: "unresolvable_contact" };
        return;
      }

      const contactNumber = dto.isGroup
        ? dto.addressing.remoteJid.replace(/\D/g, "")
        : dto.senderNumber!;

      const contactName =
        dto.pushName ||
        dto.senderNumber ||
        dto.addressing.remoteJid ||
        "WhatsApp";

      let contact: Contact;
      let groupContact: Contact | undefined;

      if (dto.isGroup) {
        groupContact = await CreateOrUpdateContactService({
          name: contactName,
          number: contactNumber,
          isGroup: true,
          companyId: dto.companyId,
          whatsappId: whatsapp.id
        });
        const participantNumber = dto.senderNumber;
        if (!participantNumber) {
          result = {
            status: "skipped",
            reason: "group_participant_unresolvable"
          };
          return;
        }
        contact = await CreateOrUpdateContactService({
          name: dto.pushName || participantNumber,
          number: participantNumber,
          isGroup: false,
          companyId: dto.companyId,
          whatsappId: whatsapp.id
        });
      } else {
        contact = await CreateOrUpdateContactService({
          name: contactName,
          number: contactNumber,
          isGroup: false,
          companyId: dto.companyId,
          whatsappId: whatsapp.id
        });
      }

      const unreadMessages = dto.fromMe ? 0 : 1;
      const ticket: Ticket = await FindOrCreateTicketService(
        contact,
        whatsapp.id,
        unreadMessages,
        dto.companyId,
        groupContact,
        {
          messageReceivedAt: dto.timestamp,
          externalStartLog: {
            remoteJid: dto.addressing.remoteJid,
            messageId: dto.messageId
          }
        }
      );

      const quoted = await resolveQuotedMessageByStanzaId(dto.quotedStanzaId);

      const message = await createEvolutionInboundMessage({
        inbound: dto,
        ticket,
        contactId: contact.id,
        quotedMsgId: quoted?.id || null,
        evolutionPayloadSanitized
      });

      try {
        const classification = classifyInboundMessageFromNormalized(
          dto,
          dto.body
        );
        logger.info(
          {
            messageId: dto.messageId,
            ticketId: ticket.id,
            classification: classification.messageType,
            provider: "evolution"
          },
          "[EvolutionInbound] classified"
        );
      } catch (err) {
        logger.debug({ err }, "[EvolutionInbound] classify skipped");
      }

      result = {
        status: "created",
        messageId: message.id,
        ticketId: ticket.id
      };
    }
  });

  return result;
}
