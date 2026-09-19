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
import {
  processInboundAutomation,
  type InboundAutomationContext
} from "../../../automation/processInboundAutomation";
import { resolveQuotedMessageByStanzaId } from "../../../inbound/resolveQuotedMessageByStanzaId";
import { applyInboundWhatsAppReaction } from "../../../inbound/applyInboundWhatsAppReaction";
import { createEvolutionInboundMessage } from "./createEvolutionInboundMessage";
import {
  EvolutionMediaExtractHints,
  extractEvolutionMedia
} from "./EvolutionMediaExtractor";
import { EvolutionHttpError } from "./evolutionHttpClient";
import { persistEvolutionMediaFile } from "./persistEvolutionMediaFile";
import { resolveWhatsappSettings } from "../../../../../helpers/resolveWhatsappSettings";
import { buildStableGroupContactFallbackName } from "../../../../../helpers/stableGroupContactFallbackName";

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
  processInboundAutomation?: typeof processInboundAutomation;
};

function toInboundAutomationContext(input: {
  inbound: NormalizedWhatsAppMessage;
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  persistedMessageId: string;
}): InboundAutomationContext {
  return {
    inbound: input.inbound,
    ticket: {
      id: input.ticket.id,
      companyId: input.ticket.companyId,
      whatsappId: input.ticket.whatsappId,
      contactId: input.ticket.contactId,
      isGroup: Boolean(input.ticket.isGroup),
      queueId: input.ticket.queueId,
      userId: input.ticket.userId,
      chatbot: input.ticket.chatbot,
      useIntegration: input.ticket.useIntegration,
      integrationId: input.ticket.integrationId,
      promptId: input.ticket.promptId
    },
    contact: {
      id: input.contact.id,
      companyId: input.contact.companyId
    },
    whatsapp: {
      id: input.whatsapp.id,
      companyId: input.whatsapp.companyId,
      integrationId: input.whatsapp.integrationId,
      promptId: input.whatsapp.promptId
    },
    persistedMessageId: input.persistedMessageId
  };
}

/**
 * Domínio Evolution inbound (texto + mídia Fase 7).
 * Sem WASocket / GetTicketWbot / raw Baileys / outbound neste handler.
 * 12.3-B: após persistência válida, entra em processInboundAutomation.
 * Consumidores Chatbot/Typebot/Flow ainda socket-bound são deferidos
 * (sem getWbot / wrapBaileysSession).
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
  const runInboundAutomation =
    deps?.processInboundAutomation || processInboundAutomation;

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

      if (dto.isGroup) {
        const groupSettings = await resolveWhatsappSettings(
          whatsapp.id,
          dto.companyId,
          "evolutionInbound:groupGate"
        );
        if (groupSettings.callsGroups.groupMessagesMode === "ignore") {
          result = {
            status: "skipped",
            reason: "group_messages_disabled"
          };
          return;
        }
      }

      if ((dto.kind || "message") === "reaction") {
        if (!dto.reaction?.targetStanzaId || !dto.reaction.emoji) {
          result = { status: "skipped", reason: "invalid_reaction" };
          return;
        }
        const applied = await applyInboundWhatsAppReaction({
          companyId: dto.companyId,
          whatsappId: dto.whatsappId,
          reactorMessageId: dto.messageId,
          fromMe: dto.fromMe,
          remoteJid: dto.addressing.remoteJid,
          participant: dto.addressing.participant || null,
          reaction: dto.reaction
        });
        if (applied.outcome === "skipped") {
          result = { status: "skipped", reason: applied.reason };
          return;
        }
        result = {
          status: "created",
          messageId: applied.targetMessageId,
          ticketId: applied.ticketId
        };
        return;
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

      const privateContactName =
        dto.pushName ||
        dto.senderNumber ||
        dto.addressing.remoteJid ||
        "WhatsApp";

      let contact: Contact;
      let groupContact: Contact | undefined;

      if (dto.isGroup) {
        groupContact = await CreateOrUpdateContactService({
          name: buildStableGroupContactFallbackName(contactNumber),
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
          name: privateContactName,
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

      await runInboundAutomation(
        toInboundAutomationContext({
          inbound: dto,
          ticket,
          contact,
          whatsapp,
          persistedMessageId: message.id
        })
      );
    }
  });

  return result;
}
