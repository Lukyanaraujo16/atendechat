import { getIO } from "../../../libs/socket";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import { serializeMessageForClient } from "../../../services/MessageServices/CreateMessageService";
import { logger } from "../../../utils/logger";
import { findMessageForStatusUpdate } from "./applyNormalizedMessageStatus";

export type ApplyInboundWhatsAppRevokeInput = {
  companyId: number;
  whatsappId: number;
  messageId: string;
  remoteJid?: string | null;
};

export type ApplyInboundWhatsAppRevokeResult =
  | {
      outcome: "updated" | "noop";
      messageId: string;
      ticketId: number;
    }
  | { outcome: "skipped"; reason: string };

const TARGET_INCLUDE = [
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

/**
 * Marca Message.isDeleted=true sem apagar linha, body ou mídia.
 * Provider-agnostic. Lookup tenant + whatsapp scoped.
 */
export async function applyInboundWhatsAppRevoke(
  input: ApplyInboundWhatsAppRevokeInput
): Promise<ApplyInboundWhatsAppRevokeResult> {
  const messageId = String(input.messageId || "").trim();
  if (!messageId) {
    return { outcome: "skipped", reason: "missing_message_id" };
  }
  if (!input.companyId || !input.whatsappId) {
    return { outcome: "skipped", reason: "missing_tenant" };
  }

  const message = await findMessageForStatusUpdate({
    companyId: input.companyId,
    whatsappId: input.whatsappId,
    messageId
  });

  if (!message) {
    logger.info(
      {
        companyId: input.companyId,
        whatsappId: input.whatsappId,
        messageId
      },
      "[WhatsAppRevoke] target not found"
    );
    return { outcome: "skipped", reason: "revoke_target_not_found" };
  }

  if (message.isDeleted) {
    return {
      outcome: "noop",
      messageId: message.id,
      ticketId: message.ticketId
    };
  }

  await message.update({ isDeleted: true });

  const refreshed = await Message.findByPk(message.id, {
    include: TARGET_INCLUDE
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
    ticketId: message.ticketId
  };
}
