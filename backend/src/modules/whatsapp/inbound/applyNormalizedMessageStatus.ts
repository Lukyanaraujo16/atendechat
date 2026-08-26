import { getIO } from "../../../libs/socket";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import { serializeMessageForClient } from "../../../services/MessageServices/CreateMessageService";
import { shouldApplyAck } from "../providers/evolution/inbound/mapEvolutionStatusToAck";
import {
  ApplyNormalizedMessageStatusResult,
  NormalizedWhatsAppMessageStatus
} from "./NormalizedWhatsAppMessageStatus";

/**
 * Lookup tenant-scoped (companyId + externalMessageId|id).
 * Opcionalmente rejeita se ticket.whatsappId ≠ status.whatsappId.
 */
export async function findMessageForStatusUpdate(input: {
  companyId: number;
  whatsappId: number;
  messageId: string;
}): Promise<Message | null> {
  const include = [
    "contact",
    {
      model: Ticket,
      as: "ticket",
      include: [
        "contact",
        "queue",
        {
          model: Whatsapp,
          as: "whatsapp",
          attributes: ["name", "ticketVisibility", "connectionProvider"]
        }
      ]
    },
    {
      model: Message,
      as: "quotedMsg",
      include: ["contact"]
    }
  ];

  let message = await Message.findOne({
    where: {
      companyId: input.companyId,
      externalMessageId: input.messageId
    },
    include
  });

  if (!message) {
    message = await Message.findOne({
      where: {
        companyId: input.companyId,
        id: input.messageId
      },
      include
    });
  }

  if (!message) return null;

  const ticketWhatsappId = message.ticket?.whatsappId;
  if (
    ticketWhatsappId != null &&
    Number(ticketWhatsappId) !== Number(input.whatsappId)
  ) {
    return null;
  }

  return message;
}

/**
 * Aplica ACK monotônico e emite o mesmo contrato Socket do frontend
 * (`company-{id}-appMessage` action update).
 * Nunca cria Message / Ticket / Contact.
 */
export async function applyNormalizedMessageStatus(
  status: NormalizedWhatsAppMessageStatus
): Promise<ApplyNormalizedMessageStatusResult> {
  if (!status.companyId || !status.whatsappId) {
    return { outcome: "skipped", reason: "missing_tenant" };
  }
  if (!status.messageId || !String(status.messageId).trim()) {
    return { outcome: "skipped", reason: "missing_message_id" };
  }
  if (!Number.isFinite(status.ack) || status.ack < 0 || status.ack > 5) {
    return { outcome: "skipped", reason: "invalid_ack" };
  }

  const message = await findMessageForStatusUpdate({
    companyId: status.companyId,
    whatsappId: status.whatsappId,
    messageId: String(status.messageId).trim()
  });

  if (!message) {
    return { outcome: "deferred", reason: "message_not_found" };
  }

  const previousAck = Number.isFinite(message.ack) ? Number(message.ack) : 0;
  if (!shouldApplyAck(previousAck, status.ack)) {
    return {
      outcome: "noop_same_or_lower",
      messageId: message.id,
      ack: previousAck
    };
  }

  await message.update({ ack: status.ack });

  const refreshed = await Message.findByPk(message.id, {
    include: [
      "contact",
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          "queue",
          {
            model: Whatsapp,
            as: "whatsapp",
            attributes: ["name", "ticketVisibility", "connectionProvider"]
          }
        ]
      },
      {
        model: Message,
        as: "quotedMsg",
        include: ["contact"]
      }
    ]
  });

  if (refreshed) {
    const io = getIO();
    io.to(refreshed.ticketId.toString()).emit(
      `company-${refreshed.companyId}-appMessage`,
      {
        action: "update",
        message: serializeMessageForClient(refreshed)
      }
    );
  }

  return {
    outcome: "updated",
    messageId: message.id,
    previousAck,
    ack: status.ack
  };
}
