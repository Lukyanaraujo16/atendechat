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
import {
  EvolutionMediaExtractHints,
  extractEvolutionMedia
} from "./EvolutionMediaExtractor";
import { EvolutionHttpError } from "./evolutionHttpClient";
import { persistEvolutionMediaFile } from "./persistEvolutionMediaFile";

export type ProcessEvolutionInboundResult =
  | { status: "created"; messageId: string; ticketId: number }
  | { status: "duplicate"; messageId: string }
  | { status: "skipped"; reason: string }
  | { status: "media_failed"; reason: string; retryable: boolean };

/** @deprecated alias Fase 6 */
export type ProcessEvolutionTextResult = ProcessEvolutionInboundResult;

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

export type ProcessEvolutionInboundDeps = {
  extractMedia?: typeof extractEvolutionMedia;
  persistMedia?: typeof persistEvolutionMediaFile;
  publicDir?: string;
};

/**
 * Domínio Evolution inbound (texto + mídia Fase 7).
 * Sem WASocket / GetTicketWbot / raw Baileys / outbound.
 * Chatbot/Typebot/Flow: skip consciente (ainda session-bound).
 */
export async function processEvolutionTextInbound(input: {
  inbound: NormalizedWhatsAppMessage;
  whatsapp: Whatsapp;
  evolutionPayloadSanitized: Record<string, unknown>;
  mediaHints?: EvolutionMediaExtractHints | null;
  deps?: ProcessEvolutionInboundDeps;
}): Promise<ProcessEvolutionInboundResult> {
  const { inbound, whatsapp, evolutionPayloadSanitized, mediaHints, deps } =
    input;
  const extractMedia = deps?.extractMedia || extractEvolutionMedia;
  const persistMedia = deps?.persistMedia || persistEvolutionMediaFile;

  let result: ProcessEvolutionInboundResult = {
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

      // Dedupe ANTES do download pesado.
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

      let mediaUrl: string | null = null;
      let persistedMediaType: string | null = null;

      if (dto.media.hasMedia) {
        const hints = mediaHints;
        if (!hints) {
          result = {
            status: "media_failed",
            reason: "missing_media_hints",
            retryable: false
          };
          return;
        }
        try {
          const extracted = await extractMedia({
            whatsappId: whatsapp.id,
            hints
          });
          const saved = await persistMedia({
            companyId: dto.companyId,
            media: extracted,
            publicDir: deps?.publicDir
          });
          mediaUrl = saved.relativeFilename;
          persistedMediaType =
            extracted.mimetype.split("/")[0] || extracted.kind;
          // Atualiza mimetype/filename no DTO para classificação.
          dto.media.mimetype = extracted.mimetype;
          dto.media.filename = extracted.filename;
        } catch (err) {
          const code =
            err instanceof EvolutionHttpError
              ? err.code
              : "MEDIA_EXTRACT_ERROR";
          logger.warn(
            {
              whatsappId: whatsapp.id,
              messageId: dto.messageId,
              messageType: dto.messageType,
              code
            },
            "[EvolutionInbound] media extract failed"
          );
          result = {
            status: "media_failed",
            reason: code,
            // Terminal no event id (ACK 2xx) — evita loop infinito de retry Evolution.
            retryable: false
          };
          return;
        }
      }

      const message = await createEvolutionInboundMessage({
        inbound: dto,
        ticket,
        contactId: contact.id,
        quotedMsgId: quoted?.id || null,
        evolutionPayloadSanitized,
        mediaUrl,
        persistedMediaType
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
            hasMedia: dto.media.hasMedia,
            isPtt: dto.media.isPtt,
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
