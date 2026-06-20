import Message from "../../models/Message";
import MetaWebhookEvent from "../../models/MetaWebhookEvent";
import InstagramAccount from "../../models/InstagramAccount";
import path from "path";
import { logger } from "../../utils/logger";
import { incrementCompanyStorageUsage } from "../CompanyService/adjustCompanyStorageUsage";
import {
  ParsedInstagramWebhookEvent,
  extractInstagramMessageAttachments,
  extractInstagramReplyToMessageId,
  resolveInstagramMessageDirection,
  isInstagramUnsupportedWebhookMessage,
  logUnsupportedInstagramWebhookPayload
} from "./InstagramWebhookParser";
import FindOrCreateInstagramContactService from "./FindOrCreateInstagramContactService";
import FindOrCreateInstagramTicketService from "./FindOrCreateInstagramTicketService";
import CreateInstagramInboundMessageService from "./CreateInstagramInboundMessageService";
import CreateInstagramOutboundSyncMessageService from "./CreateInstagramOutboundSyncMessageService";
import EnrichInstagramContactProfileService from "./EnrichInstagramContactProfileService";
import DownloadInstagramMediaService from "./DownloadInstagramMediaService";
import DownloadInstagramShareThumbnailService from "./DownloadInstagramShareThumbnailService";
import { resolveInstagramShareContent } from "./ProcessInstagramShareService";
import { isPlayableVideoAttachment } from "./instagramShareUtils";
import { resolveInstagramQuotedMessageId } from "./resolveInstagramQuotedMessage";
import resolveInstagramAccountToken from "./resolveInstagramAccountToken";

interface Request {
  parsed: ParsedInstagramWebhookEvent;
  instagramAccountId: number;
  companyId: number;
  externalEventId: string;
  webhookEventId?: number | null;
}

interface ResolvedInstagramMessageContent {
  body: string;
  mediaType: string;
  mediaUrl?: string | null;
  shareMeta?: Record<string, unknown> | null;
  unsupportedMeta?: Record<string, unknown> | null;
}

const INSTAGRAM_UNSUPPORTED_MESSAGE_BODY =
  "📱 Conteúdo compartilhado do Instagram\n\n" +
  "Este tipo de conteúdo não é disponibilizado pela API do Instagram.\n\n" +
  "Para visualizar o conteúdo completo, acesse diretamente o aplicativo Instagram.";

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

const AUDIO_ATTACHMENT_TYPES = new Set(["audio"]);
const FILE_ATTACHMENT_TYPES = new Set(["file"]);

const extractFilenameFromUrl = (url: string | null): string | null => {
  if (!url) return null;
  try {
    const base = path.basename(new URL(url).pathname);
    if (!base || base === "/") return null;
    return decodeURIComponent(base);
  } catch {
    return null;
  }
};

const downloadInstagramAttachment = async ({
  attachment,
  parsed,
  companyId,
  accessToken,
  text,
  mediaKind,
  messageMediaType,
  defaultLabel,
  failLabel,
  receivedLog
}: {
  attachment: { type: string; url: string | null };
  parsed: ParsedInstagramWebhookEvent;
  companyId: number;
  accessToken: string;
  text: string | null;
  mediaKind: "image" | "video" | "audio" | "document";
  messageMediaType: string;
  defaultLabel: string;
  failLabel: string;
  receivedLog: string;
}): Promise<ResolvedInstagramMessageContent> => {
  logger.info(
    {
      messageId: parsed.messageId,
      attachmentsCount: parsed.attachmentsCount,
      attachmentType: attachment.type
    },
    receivedLog
  );

  if (attachment.url && parsed.messageId) {
    try {
      const downloaded = await DownloadInstagramMediaService({
        url: attachment.url,
        accessToken,
        companyId,
        messageId: parsed.messageId,
        mediaKind
      });

      if (downloaded.bytes > 0) {
        void incrementCompanyStorageUsage(companyId, downloaded.bytes);
      }

      return {
        body: text || defaultLabel,
        mediaType: messageMediaType,
        mediaUrl: downloaded.relativePath
      };
    } catch {
      return {
        body: text || failLabel,
        mediaType: "chat",
        mediaUrl: null
      };
    }
  }

  return {
    body: text || failLabel,
    mediaType: "chat",
    mediaUrl: null
  };
};

const resolveInstagramMessageContent = async ({
  parsed,
  companyId,
  accessToken
}: {
  parsed: ParsedInstagramWebhookEvent;
  companyId: number;
  accessToken: string;
}): Promise<ResolvedInstagramMessageContent | null> => {
  if (isInstagramUnsupportedWebhookMessage(parsed)) {
    logger.info(
      {
        messageId: parsed.messageId,
        senderId: parsed.senderId,
        recipientId: parsed.recipientId
      },
      "[InstagramUnsupported] received"
    );

    return {
      body: INSTAGRAM_UNSUPPORTED_MESSAGE_BODY,
      mediaType: "instagram_unsupported",
      mediaUrl: null,
      unsupportedMeta: {
        unsupported: true,
        originalMessageId: parsed.messageId
      }
    };
  }

  const text = extractMessageText(parsed);
  const attachments = extractInstagramMessageAttachments(parsed);
  const shareContent = resolveInstagramShareContent(parsed, text);
  if (shareContent) {
    let shareMeta = { ...shareContent.shareMeta };
    const thumbnailSourceUrl =
      typeof shareMeta.thumbnailSourceUrl === "string"
        ? shareMeta.thumbnailSourceUrl
        : null;

    if (thumbnailSourceUrl && parsed.messageId) {
      const thumbnail = await DownloadInstagramShareThumbnailService({
        thumbnailSourceUrl,
        accessToken,
        companyId,
        messageId: parsed.messageId
      });

      if (thumbnail) {
        shareMeta = {
          ...shareMeta,
          thumbnailUrl: thumbnail.relativePath
        };
        if (thumbnail.bytes > 0) {
          void incrementCompanyStorageUsage(companyId, thumbnail.bytes);
        }
      }
    }

    return {
      body: text || shareContent.body,
      mediaType: shareContent.mediaType,
      mediaUrl: shareContent.mediaUrl,
      shareMeta
    };
  }

  const imageAttachment = attachments.find(item => item.type === "image");
  const videoAttachment = attachments.find(item =>
    isPlayableVideoAttachment(item)
  );
  const audioAttachment = attachments.find(item =>
    AUDIO_ATTACHMENT_TYPES.has(item.type)
  );
  const fileAttachment = attachments.find(item =>
    FILE_ATTACHMENT_TYPES.has(item.type)
  );

  if (imageAttachment) {
    return downloadInstagramAttachment({
      attachment: imageAttachment,
      parsed,
      companyId,
      accessToken,
      text,
      mediaKind: "image",
      messageMediaType: "image",
      defaultLabel: "Imagem",
      failLabel: "Imagem recebida (falha ao baixar mídia)",
      receivedLog: "[InstagramMediaInbound] received"
    });
  }

  if (videoAttachment) {
    return downloadInstagramAttachment({
      attachment: videoAttachment,
      parsed,
      companyId,
      accessToken,
      text,
      mediaKind: "video",
      messageMediaType: "video",
      defaultLabel: "Vídeo",
      failLabel: "Vídeo recebido (falha ao baixar mídia)",
      receivedLog: "[InstagramVideoInbound] received"
    });
  }

  if (audioAttachment) {
    return downloadInstagramAttachment({
      attachment: audioAttachment,
      parsed,
      companyId,
      accessToken,
      text,
      mediaKind: "audio",
      messageMediaType: "audio",
      defaultLabel: "Áudio",
      failLabel: "Áudio recebido (falha ao baixar mídia)",
      receivedLog: "[InstagramAudioInbound] received"
    });
  }

  if (fileAttachment) {
    const filenameFromUrl = extractFilenameFromUrl(fileAttachment.url);
    return downloadInstagramAttachment({
      attachment: fileAttachment,
      parsed,
      companyId,
      accessToken,
      text: text || filenameFromUrl,
      mediaKind: "document",
      messageMediaType: "document",
      defaultLabel: filenameFromUrl || "Documento",
      failLabel: "Documento recebido (falha ao baixar mídia)",
      receivedLog: "[InstagramDocumentInbound] received"
    });
  }

  if (text) {
    return {
      body: text,
      mediaType: "chat",
      mediaUrl: null
    };
  }

  logUnsupportedInstagramWebhookPayload(parsed, logger);
  return null;
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

  const { accessToken } = await resolveInstagramAccountToken(
    instagramAccountId,
    companyId
  );

  const content = await resolveInstagramMessageContent({
    parsed,
    companyId,
    accessToken
  });

  if (!content) {
    await markWebhookProcessed(webhookEventId, externalEventId);
    return "skipped";
  }

  if (fromMe) {
    logger.info(
      {
        accountId: account.id,
        companyId,
        instagramBusinessAccountId: account.instagramBusinessAccountId,
        senderId: parsed.senderId,
        recipientId: parsed.recipientId,
        messageId: parsed.messageId,
        isEcho: parsed.isEcho,
        mediaType: content.mediaType
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
        hasText: Boolean(extractMessageText(parsed)),
        mediaType: content.mediaType,
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
    lastMessage: content.body,
    unreadMessages: fromMe ? 0 : 1
  });

  const metaPayload = {
    channel: "instagram",
    messageId: parsed.messageId,
    senderId: parsed.senderId,
    recipientId: parsed.recipientId,
    timestamp: parsed.timestamp,
    fromMe,
    isEcho: parsed.isEcho,
    mediaType: content.mediaType,
    replyToMessageId: extractInstagramReplyToMessageId(parsed),
    share: content.shareMeta ?? null,
    attachments: extractInstagramMessageAttachments(parsed),
    ...(content.mediaType === "instagram_unsupported"
      ? {
          unsupported: true,
          originalMessageId: parsed.messageId
        }
      : {})
  };

  const quotedMsgId = await resolveInstagramQuotedMessageId({
    companyId,
    replyToExternalMessageId: extractInstagramReplyToMessageId(parsed),
    ticketId: ticket.id
  });

  const messagePayload = {
    id: parsed.messageId,
    ticketId: ticket.id,
    contactId: enrichedContact.id,
    body: content.body,
    externalMessageId: parsed.messageId,
    mediaType: content.mediaType,
    mediaUrl: content.mediaUrl ?? null,
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

  if (fromMe) {
    logger.info(
      {
        ticketId: ticket.id,
        messageId: parsed.messageId,
        contactId: enrichedContact.id,
        accountId: account.id,
        mediaType: content.mediaType
      },
      "[InstagramOutboundSync] message_saved"
    );
  } else if (content.mediaType === "instagram_unsupported") {
    logger.info(
      {
        ticketId: ticket.id,
        messageId: parsed.messageId,
        contactId: enrichedContact.id,
        accountId: account.id,
        mediaType: content.mediaType
      },
      "[InstagramUnsupported] message_saved"
    );
  } else {
    logger.info(
      {
        ticketId: ticket.id,
        messageId: parsed.messageId,
        contactId: enrichedContact.id,
        accountId: account.id,
        mediaType: content.mediaType
      },
      "[InstagramInbound] message_saved"
    );
  }

  return "saved";
};

export default ProcessInstagramDirectMessageService;
