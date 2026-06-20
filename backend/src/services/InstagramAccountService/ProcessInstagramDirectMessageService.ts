import Message from "../../models/Message";
import MetaWebhookEvent from "../../models/MetaWebhookEvent";
import InstagramAccount from "../../models/InstagramAccount";
import { logger } from "../../utils/logger";
import {
  ParsedInstagramWebhookEvent,
  resolveInstagramMessageDirection
} from "./InstagramWebhookParser";
import FindOrCreateInstagramContactService from "./FindOrCreateInstagramContactService";
import FindOrCreateInstagramTicketService from "./FindOrCreateInstagramTicketService";
import CreateInstagramInboundMessageService from "./CreateInstagramInboundMessageService";
import CreateInstagramOutboundSyncMessageService from "./CreateInstagramOutboundSyncMessageService";
import EnrichInstagramContactProfileService from "./EnrichInstagramContactProfileService";

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

const isDuplicateMessage = async (
  companyId: number,
  messageId: string,
  duplicateLog: string
): Promise<boolean> => {
  const existingMessage = await Message.findOne({
    where: {
      companyId,
      externalMessageId: messageId
    },
    attributes: ["id"]
  });

  if (existingMessage) {
    logger.info(
      { messageId, existingId: existingMessage.id },
      duplicateLog
    );
    return true;
  }

  const existingById = await Message.findByPk(messageId, {
    attributes: ["id"]
  });

  if (existingById) {
    logger.info({ messageId }, duplicateLog);
    return true;
  }

  return false;
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

  if (!account?.instagramBusinessAccountId) {
    logger.warn(
      { instagramAccountId, companyId },
      "[InstagramInbound] account_not_connected"
    );
    return "skipped";
  }

  const direction = resolveInstagramMessageDirection(
    parsed,
    account.instagramBusinessAccountId
  );

  if (!direction) {
    logger.info(
      {
        senderId: parsed.senderId,
        recipientId: parsed.recipientId,
        entryId: parsed.entryId,
        instagramBusinessAccountId: account.instagramBusinessAccountId
      },
      "[InstagramInbound] unsupported_message_type"
    );
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "skipped";
  }

  const { fromMe, contactScopedId } = direction;

  if (fromMe) {
    logger.info(
      {
        accountId: account.id,
        companyId,
        instagramBusinessAccountId: account.instagramBusinessAccountId,
        senderId: parsed.senderId,
        recipientId: parsed.recipientId,
        messageId: parsed.messageId,
        isEcho: parsed.isEcho
      },
      "[InstagramOutboundSync] received"
    );

    logger.info(
      {
        accountId: account.id,
        companyId,
        instagramBusinessAccountId: account.instagramBusinessAccountId
      },
      "[InstagramOutboundSync] account_mapped"
    );
  } else {
    logger.info(
      {
        accountId: account.id,
        companyId,
        senderId: parsed.senderId,
        recipientId: parsed.recipientId,
        messageId: parsed.messageId,
        hasText: true,
        webhookSenderKeys: parsed.rawMessagingItem?.sender
          ? Object.keys(
              parsed.rawMessagingItem.sender as Record<string, unknown>
            )
          : []
      },
      "[InstagramInbound] received"
    );
  }

  const duplicateLog = fromMe
    ? "[InstagramOutboundSync] duplicate_skipped"
    : "[InstagramInbound] duplicate skipped";

  if (await isDuplicateMessage(companyId, parsed.messageId, duplicateLog)) {
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "duplicate";
  }

  const { contact } = await FindOrCreateInstagramContactService({
    companyId,
    senderId: contactScopedId
  });

  const enrichedContact = await EnrichInstagramContactProfileService({
    contact,
    companyId,
    instagramAccountId: account.id,
    senderId: contactScopedId
  });

  const { ticket } = await FindOrCreateInstagramTicketService({
    contactId: enrichedContact.id,
    companyId,
    instagramAccountId: account.id,
    lastMessage: text,
    unreadMessages: fromMe ? 0 : 1
  });

  const metaPayload = {
    channel: "instagram",
    messageId: parsed.messageId,
    senderId: parsed.senderId,
    recipientId: parsed.recipientId,
    timestamp: parsed.timestamp,
    fromMe,
    isEcho: parsed.isEcho
  };

  if (fromMe) {
    await CreateInstagramOutboundSyncMessageService({
      companyId,
      messageData: {
        id: parsed.messageId,
        ticketId: ticket.id,
        contactId: enrichedContact.id,
        body: text,
        externalMessageId: parsed.messageId,
        metaPayload,
        queueId: ticket.queueId
      }
    });
  } else {
    await CreateInstagramInboundMessageService({
      companyId,
      messageData: {
        id: parsed.messageId,
        ticketId: ticket.id,
        contactId: enrichedContact.id,
        body: text,
        externalMessageId: parsed.messageId,
        metaPayload,
        queueId: ticket.queueId
      }
    });
  }

  await markWebhookProcessed(webhookEventId, externalEventId);

  if (fromMe) {
    logger.info(
      {
        ticketId: ticket.id,
        messageId: parsed.messageId,
        contactId: enrichedContact.id,
        accountId: account.id
      },
      "[InstagramOutboundSync] message_saved"
    );
  } else {
    logger.info(
      {
        ticketId: ticket.id,
        messageId: parsed.messageId,
        contactId: enrichedContact.id,
        accountId: account.id
      },
      "[InstagramInbound] message_saved"
    );
  }

  return "saved";
};

export default ProcessInstagramDirectMessageService;
