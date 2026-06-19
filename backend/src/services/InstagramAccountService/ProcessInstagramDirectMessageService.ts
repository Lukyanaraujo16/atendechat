import Message from "../../models/Message";
import MetaWebhookEvent from "../../models/MetaWebhookEvent";
import InstagramAccount from "../../models/InstagramAccount";
import { logger } from "../../utils/logger";
import { ParsedInstagramWebhookEvent } from "./InstagramWebhookParser";
import FindOrCreateInstagramContactService from "./FindOrCreateInstagramContactService";
import FindOrCreateInstagramTicketService from "./FindOrCreateInstagramTicketService";
import CreateInstagramInboundMessageService from "./CreateInstagramInboundMessageService";

interface Request {
  parsed: ParsedInstagramWebhookEvent;
  instagramAccountId: number;
  companyId: number;
  externalEventId: string;
  webhookEventId?: number | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const extractMessageText = (parsed: ParsedInstagramWebhookEvent): string | null => {
  const item = parsed.rawMessagingItem;
  const message = item ? asRecord(item.message) : null;
  const text = message?.text;
  if (typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const markWebhookProcessed = async (
  webhookEventId: number | null | undefined,
  externalEventId: string
): Promise<void> => {
  if (webhookEventId) {
    await MetaWebhookEvent.update(
      { processed: true },
      { where: { id: webhookEventId } }
    );
    return;
  }

  await MetaWebhookEvent.update(
    { processed: true },
    { where: { externalEventId } }
  );
};

const ProcessInstagramDirectMessageService = async ({
  parsed,
  instagramAccountId,
  companyId,
  externalEventId,
  webhookEventId
}: Request): Promise<"saved" | "skipped" | "duplicate"> => {
  if (parsed.object !== "instagram") {
    return "skipped";
  }

  if (parsed.eventType !== "message") {
    return "skipped";
  }

  if (!parsed.senderId || !parsed.recipientId || !parsed.messageId) {
    logger.info(
      {
        senderId: parsed.senderId,
        recipientId: parsed.recipientId,
        messageId: parsed.messageId
      },
      "[InstagramInbound] unsupported_message_type"
    );
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "skipped";
  }

  const text = extractMessageText(parsed);
  if (!text) {
    logger.info(
      {
        messageId: parsed.messageId,
        attachmentsCount: parsed.attachmentsCount,
        eventType: parsed.eventType
      },
      "[InstagramInbound] unsupported_message_type"
    );
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "skipped";
  }

  const account = await InstagramAccount.findOne({
    where: {
      id: instagramAccountId,
      companyId,
      status: "CONNECTED"
    },
    attributes: ["id", "companyId", "name", "instagramBusinessAccountId"]
  });

  if (!account) {
    logger.warn(
      { instagramAccountId, companyId },
      "[InstagramInbound] account_not_connected"
    );
    return "skipped";
  }

  logger.info(
    {
      accountId: account.id,
      companyId,
      senderId: parsed.senderId,
      recipientId: parsed.recipientId,
      messageId: parsed.messageId,
      hasText: true
    },
    "[InstagramInbound] received"
  );

  const existingMessage = await Message.findOne({
    where: {
      companyId,
      externalMessageId: parsed.messageId
    },
    attributes: ["id"]
  });

  if (existingMessage) {
    logger.info(
      { messageId: parsed.messageId, existingId: existingMessage.id },
      "[InstagramInbound] duplicate skipped"
    );
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "duplicate";
  }

  const existingById = await Message.findByPk(parsed.messageId, {
    attributes: ["id"]
  });
  if (existingById) {
    logger.info(
      { messageId: parsed.messageId },
      "[InstagramInbound] duplicate skipped"
    );
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "duplicate";
  }

  const { contact } = await FindOrCreateInstagramContactService({
    companyId,
    senderId: parsed.senderId
  });

  const { ticket } = await FindOrCreateInstagramTicketService({
    contactId: contact.id,
    companyId,
    instagramAccountId: account.id,
    lastMessage: text,
    unreadMessages: 1
  });

  const metaPayload = {
    channel: "instagram",
    messageId: parsed.messageId,
    senderId: parsed.senderId,
    recipientId: parsed.recipientId,
    timestamp: parsed.timestamp
  };

  await CreateInstagramInboundMessageService({
    companyId,
    messageData: {
      id: parsed.messageId,
      ticketId: ticket.id,
      contactId: contact.id,
      body: text,
      externalMessageId: parsed.messageId,
      metaPayload,
      queueId: ticket.queueId
    }
  });

  await markWebhookProcessed(webhookEventId, externalEventId);

  logger.info(
    {
      ticketId: ticket.id,
      messageId: parsed.messageId,
      contactId: contact.id,
      accountId: account.id
    },
    "[InstagramInbound] message_saved"
  );

  return "saved";
};

export default ProcessInstagramDirectMessageService;
