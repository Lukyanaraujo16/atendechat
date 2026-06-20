import Message from "../../models/Message";
import MetaWebhookEvent from "../../models/MetaWebhookEvent";
import InstagramAccount from "../../models/InstagramAccount";
import { logger } from "../../utils/logger";
import {
  extractInstagramReactionFromEvent,
  ParsedInstagramWebhookEvent,
  resolveInstagramMessageDirection
} from "./InstagramWebhookParser";
import FindOrCreateInstagramContactService from "./FindOrCreateInstagramContactService";
import FindOrCreateInstagramTicketService from "./FindOrCreateInstagramTicketService";
import CreateInstagramInboundMessageService from "./CreateInstagramInboundMessageService";
import CreateInstagramOutboundSyncMessageService from "./CreateInstagramOutboundSyncMessageService";
import { resolveInstagramQuotedMessageId } from "./resolveInstagramQuotedMessage";

interface Request {
  parsed: ParsedInstagramWebhookEvent;
  instagramAccountId: number;
  companyId: number;
  externalEventId: string;
  webhookEventId?: number | null;
}

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

const ProcessInstagramReactionService = async ({
  parsed,
  instagramAccountId,
  companyId,
  externalEventId,
  webhookEventId
}: Request): Promise<"saved" | "skipped" | "duplicate"> => {
  if (parsed.object !== "instagram" || parsed.eventType !== "reaction") {
    return "skipped";
  }

  const reaction = extractInstagramReactionFromEvent(parsed);
  if (!reaction || reaction.action === "unreact") {
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "skipped";
  }

  if (!parsed.senderId || !parsed.recipientId) {
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "skipped";
  }

  const account = await InstagramAccount.findOne({
    where: {
      id: instagramAccountId,
      companyId,
      status: "CONNECTED"
    },
    attributes: ["id", "companyId", "instagramBusinessAccountId"]
  });

  if (!account?.instagramBusinessAccountId) {
    return "skipped";
  }

  const direction = resolveInstagramMessageDirection(
    parsed,
    account.instagramBusinessAccountId
  );

  if (!direction) {
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "skipped";
  }

  const { fromMe, contactScopedId } = direction;

  logger.info(
    {
      companyId,
      accountId: account.id,
      senderId: parsed.senderId,
      recipientId: parsed.recipientId,
      targetMessageId: reaction.targetMessageId,
      emoji: reaction.emoji,
      action: reaction.action
    },
    "[InstagramReaction] received"
  );

  const reactionMessageId =
    externalEventId ||
    `${reaction.targetMessageId || "unknown"}_reaction_${reaction.emoji}_${parsed.timestamp || Date.now()}`;

  const existing = await Message.findOne({
    where: { companyId, externalMessageId: reactionMessageId },
    attributes: ["id"]
  });

  if (existing) {
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "duplicate";
  }

  const quotedMsgId = await resolveInstagramQuotedMessageId({
    companyId,
    replyToExternalMessageId: reaction.targetMessageId
  });

  const emojiLabel = reaction.emoji || "❤️";
  const body = `${emojiLabel} reagiu a uma mensagem`;

  const { contact } = await FindOrCreateInstagramContactService({
    companyId,
    senderId: contactScopedId
  });

  const { ticket } = await FindOrCreateInstagramTicketService({
    contactId: contact.id,
    companyId,
    instagramAccountId: account.id,
    lastMessage: body,
    unreadMessages: fromMe ? 0 : 1
  });

  const metaPayload = {
    channel: "instagram",
    messageId: reactionMessageId,
    senderId: parsed.senderId,
    recipientId: parsed.recipientId,
    timestamp: parsed.timestamp,
    fromMe,
    mediaType: "reaction",
    reaction: {
      emoji: reaction.emoji,
      action: reaction.action,
      targetMessageId: reaction.targetMessageId,
      reactionType: reaction.reactionType
    }
  };

  const messagePayload = {
    id: reactionMessageId,
    ticketId: ticket.id,
    contactId: contact.id,
    body,
    externalMessageId: reactionMessageId,
    mediaType: "reaction",
    mediaUrl: null,
    metaPayload,
    quotedMsgId,
    queueId: ticket.queueId
  };

  if (fromMe) {
    await CreateInstagramOutboundSyncMessageService({
      companyId,
      messageData: messagePayload
    });
  } else {
    await CreateInstagramInboundMessageService({
      companyId,
      messageData: messagePayload
    });
  }

  await markWebhookProcessed(webhookEventId, externalEventId);

  logger.info(
    {
      ticketId: ticket.id,
      messageId: reactionMessageId,
      targetMessageId: reaction.targetMessageId,
      quotedMsgId
    },
    "[InstagramReaction] saved"
  );

  return "saved";
};

export default ProcessInstagramReactionService;
