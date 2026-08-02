import { logger } from "../../utils/logger";
import { acquireTicketPushDedupe } from "./pushDedupe";
import SendOneSignalPushNotificationService from "./SendOneSignalPushNotificationService";
import { resolveInternalChatPushRecipients } from "./ResolveInternalChatPushRecipientsService";
import {
  INTERNAL_CHAT_PUSH_TITLE,
  buildInternalChatPushBody,
  buildInternalChatTargetUrl
} from "./internalChatPushContent";

export type NotifyInternalChatMessageInput = {
  companyId: number;
  chatId: number;
  messageId: number;
  senderUserId: number;
  senderName?: string | null;
  messageText?: string | null;
  mediaType?: string | null;
  mimeType?: string | null;
};

/**
 * Push OneSignal para nova mensagem de chat interno.
 * Best-effort: falhas não propagam (não bloqueiam persistência/socket).
 */
const notifyInternalChatMessage = async (
  input: NotifyInternalChatMessageInput
): Promise<void> => {
  const {
    companyId,
    chatId,
    messageId,
    senderUserId,
    senderName,
    messageText,
    mediaType,
    mimeType
  } = input;

  try {
    if (
      !companyId ||
      !chatId ||
      messageId == null ||
      Number.isNaN(Number(messageId)) ||
      senderUserId == null
    ) {
      logger.info(
        {
          eventType: "internal_chat_message",
          companyId,
          chatId,
          messageId,
          senderUserId,
          skipped: "invalid_input"
        },
        "[OneSignalPush]"
      );
      return;
    }

    const dedupeKey = `internal-chat:msg:${messageId}`;
    const acquired = await acquireTicketPushDedupe(dedupeKey, 120);
    if (!acquired) {
      logger.info(
        {
          eventType: "internal_chat_message",
          companyId,
          chatId,
          messageId,
          senderUserId,
          skipped: "dedupe_message",
          skippedReason: "dedupe_message"
        },
        "[OneSignalPush]"
      );
      return;
    }

    const { recipientUserIds, chatUuid, chatExists } =
      await resolveInternalChatPushRecipients({
        companyId,
        chatId,
        senderUserId
      });

    if (!chatExists) {
      logger.info(
        {
          eventType: "internal_chat_message",
          companyId,
          chatId,
          messageId,
          senderUserId,
          skipped: "chat_not_found",
          skippedReason: "chat_not_found",
          recipientCount: 0
        },
        "[OneSignalPush]"
      );
      return;
    }

    if (!recipientUserIds.length) {
      logger.info(
        {
          eventType: "internal_chat_message",
          companyId,
          chatId,
          messageId,
          senderUserId,
          skipped: "no_recipients",
          skippedReason: "no_recipients",
          recipientCount: 0
        },
        "[OneSignalPush]"
      );
      return;
    }

    const title = INTERNAL_CHAT_PUSH_TITLE;
    const body = buildInternalChatPushBody({
      senderName,
      messageText,
      mediaType,
      mimeType
    });
    const targetUrl = buildInternalChatTargetUrl(chatUuid, chatId);

    await SendOneSignalPushNotificationService({
      eventType: "internal_chat_message",
      preferenceCategory: null,
      companyId,
      chatId,
      ticketId: null,
      messageId,
      recipientUserIds,
      title,
      body,
      applyActiveTicketViewFilter: false,
      excludeUserIds: [senderUserId],
      data: {
        type: "internal_chat_message",
        companyId,
        chatId,
        chatUuid: chatUuid || undefined,
        targetUrl
      }
    });
  } catch (err) {
    logger.warn(
      {
        err,
        eventType: "internal_chat_message",
        companyId,
        chatId,
        messageId,
        senderUserId,
        errorCode: "notify_internal_chat_failed"
      },
      "[OneSignalPush] notifyInternalChatMessage"
    );
  }
};

export default notifyInternalChatMessage;
