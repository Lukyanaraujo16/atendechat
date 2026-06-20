import { redactSensitiveText } from "../../helpers/maskSensitive";

export interface ParsedInstagramWebhookEvent {
  object: string;
  entryId: string | null;
  instagramBusinessAccountId: string | null;
  senderId: string | null;
  recipientId: string | null;
  timestamp: number | null;
  messageId: string | null;
  replyToMessageId: string | null;
  eventType: string | null;
  hasText: boolean;
  textPreview: string | null;
  attachmentsCount: number;
  isEcho: boolean;
  rawMessagingItem: Record<string, unknown> | null;
}

export interface InstagramWebhookReaction {
  targetMessageId: string | null;
  emoji: string | null;
  action: string | null;
  reactionType: string | null;
}

export interface InstagramWebhookMessageDirection {
  fromMe: boolean;
  contactScopedId: string;
}

export interface InstagramWebhookAttachment {
  type: string;
  url: string | null;
  payload: Record<string, unknown> | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const detectEventType = (item: Record<string, unknown>): string => {
  if (item.message) return "message";
  if (item.read) return "read";
  if (item.delivery) return "delivery";
  if (item.reaction) return "reaction";
  if (item.postback) return "postback";
  if (item.referral) return "referral";
  return "unknown";
};

const extractTextPreview = (message: Record<string, unknown>): string | null => {
  const text = message.text;
  if (typeof text !== "string" || !text.trim()) {
    return null;
  }
  const trimmed = text.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
};

const parseMessagingItem = (
  object: string,
  entryId: string | null,
  item: Record<string, unknown>
): ParsedInstagramWebhookEvent => {
  const sender = asRecord(item.sender);
  const recipient = asRecord(item.recipient);
  const message = asRecord(item.message);

  const senderId = sender?.id != null ? String(sender.id) : null;
  const recipientId = recipient?.id != null ? String(recipient.id) : null;
  const messageId =
    message?.mid != null
      ? String(message.mid)
      : message?.id != null
        ? String(message.id)
        : null;

  const replyTo = asRecord(message?.reply_to);
  const replyToMessageId =
    replyTo?.mid != null
      ? String(replyTo.mid)
      : replyTo?.message_id != null
        ? String(replyTo.message_id)
        : null;

  const attachments = Array.isArray(message?.attachments)
    ? message.attachments
    : [];

  const timestamp =
    typeof item.timestamp === "number"
      ? item.timestamp
      : item.timestamp != null
        ? Number(item.timestamp)
        : null;

  return {
    object,
    entryId,
    // entry.id is the connected business account; recipient is only business on inbound DMs.
    instagramBusinessAccountId: entryId || senderId || recipientId,
    senderId,
    recipientId,
    timestamp: Number.isFinite(timestamp) ? timestamp : null,
    messageId,
    replyToMessageId,
    eventType: detectEventType(item),
    hasText: Boolean(message && typeof message.text === "string" && message.text),
    textPreview: message ? extractTextPreview(message) : null,
    attachmentsCount: attachments.length,
    isEcho: message?.is_echo === true,
    rawMessagingItem: item
  };
};

export const collectInstagramBusinessAccountCandidateIds = (
  parsed: ParsedInstagramWebhookEvent
): string[] => {
  const candidates = [
    parsed.entryId,
    parsed.instagramBusinessAccountId,
    parsed.senderId,
    parsed.recipientId
  ];

  return [...new Set(candidates.filter((id): id is string => Boolean(id)))];
};

/**
 * Inbound: sender = cliente, recipient = conta business.
 * Outbound (app oficial / echo): sender = conta business, recipient = cliente.
 */
export const resolveInstagramMessageDirection = (
  parsed: ParsedInstagramWebhookEvent,
  businessAccountId: string
): InstagramWebhookMessageDirection | null => {
  if (!parsed.senderId || !parsed.recipientId) {
    return null;
  }

  if (parsed.isEcho || parsed.senderId === businessAccountId) {
    return { fromMe: true, contactScopedId: parsed.recipientId };
  }

  if (parsed.recipientId === businessAccountId) {
    return { fromMe: false, contactScopedId: parsed.senderId };
  }

  if (parsed.entryId === parsed.senderId) {
    return { fromMe: true, contactScopedId: parsed.recipientId };
  }

  if (parsed.entryId === parsed.recipientId) {
    return { fromMe: false, contactScopedId: parsed.senderId };
  }

  return null;
};

export const parseInstagramWebhookPayload = (
  payload: Record<string, unknown>
): ParsedInstagramWebhookEvent[] => {
  const object =
    typeof payload.object === "string" ? payload.object : "unknown";
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const parsed: ParsedInstagramWebhookEvent[] = [];

  for (const entryRaw of entries) {
    const entry = asRecord(entryRaw);
    if (!entry) continue;

    const entryId = entry.id != null ? String(entry.id) : null;
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : [];

    for (const itemRaw of messaging) {
      const item = asRecord(itemRaw);
      if (!item) continue;
      parsed.push(parseMessagingItem(object, entryId, item));
    }

    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const changeRaw of changes) {
      const change = asRecord(changeRaw);
      if (!change) continue;
      parsed.push({
        object,
        entryId,
        instagramBusinessAccountId: entryId,
        senderId: null,
        recipientId: entryId,
        timestamp:
          typeof entry.time === "number"
            ? entry.time
            : entry.time != null
              ? Number(entry.time)
              : null,
        messageId: null,
        replyToMessageId: null,
        eventType:
          typeof change.field === "string" ? `change:${change.field}` : "change",
        hasText: false,
        textPreview: null,
        attachmentsCount: 0,
        isEcho: false,
        rawMessagingItem: change
      });
    }
  }

  if (!parsed.length) {
    parsed.push({
      object,
      entryId: null,
      instagramBusinessAccountId: null,
      senderId: null,
      recipientId: null,
      timestamp: null,
      messageId: null,
      replyToMessageId: null,
      eventType: "payload",
      hasText: false,
      textPreview: null,
      attachmentsCount: 0,
      isEcho: false,
      rawMessagingItem: null
    });
  }

  return parsed;
};

export const extractInstagramMessageAttachments = (
  parsed: ParsedInstagramWebhookEvent
): InstagramWebhookAttachment[] => {
  const message = parsed.rawMessagingItem
    ? asRecord(parsed.rawMessagingItem.message)
    : null;
  const attachments = Array.isArray(message?.attachments)
    ? message.attachments
    : [];

  return attachments
    .map(item => {
      const record = asRecord(item);
      if (!record) return null;
      const payload = asRecord(record.payload);
      const url =
        typeof payload?.url === "string" && payload.url.trim()
          ? payload.url.trim()
          : null;
      const type =
        typeof record.type === "string" ? record.type.toLowerCase() : "unknown";
      return { type, url, payload };
    })
    .filter((item): item is InstagramWebhookAttachment => Boolean(item));
};

export const extractInstagramReplyToMessageId = (
  parsed: ParsedInstagramWebhookEvent
): string | null => parsed.replyToMessageId;

export const isInstagramUnsupportedWebhookMessage = (
  parsed: ParsedInstagramWebhookEvent
): boolean => {
  const message = parsed.rawMessagingItem
    ? asRecord(parsed.rawMessagingItem.message)
    : null;

  return message?.is_unsupported === true;
};

export const extractInstagramReactionFromEvent = (
  parsed: ParsedInstagramWebhookEvent
): InstagramWebhookReaction | null => {
  const reaction = parsed.rawMessagingItem
    ? asRecord(parsed.rawMessagingItem.reaction)
    : null;

  if (!reaction) {
    return null;
  }

  const targetMessageIdRaw = reaction.mid ?? reaction.message_id;
  return {
    targetMessageId:
      targetMessageIdRaw != null ? String(targetMessageIdRaw) : null,
    emoji:
      typeof reaction.emoji === "string" && reaction.emoji.trim()
        ? reaction.emoji.trim()
        : null,
    action:
      typeof reaction.action === "string" ? reaction.action.toLowerCase() : null,
    reactionType:
      typeof reaction.reaction === "string" ? reaction.reaction : null
  };
};

const SENSITIVE_LOG_KEYS = new Set([
  "access_token",
  "accesstoken",
  "input_token",
  "token",
  "authorization",
  "pageaccesstoken",
  "appsecret",
  "client_secret",
  "app_secret"
]);

const sanitizeWebhookValueForLog = (
  value: unknown,
  depth = 0
): unknown => {
  if (depth > 10) {
    return "[max_depth]";
  }

  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveText(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeWebhookValueForLog(item, depth + 1));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(record)) {
      if (SENSITIVE_LOG_KEYS.has(key.toLowerCase())) {
        sanitized[key] = "***";
        continue;
      }

      sanitized[key] = sanitizeWebhookValueForLog(nestedValue, depth + 1);
    }

    return sanitized;
  }

  return String(value);
};

const normalizeAttachmentForLog = (
  attachmentRaw: unknown
): Record<string, unknown> | null => {
  const attachment = asRecord(attachmentRaw);
  if (!attachment) {
    return null;
  }

  const payload = asRecord(attachment.payload);

  return {
    type: attachment.type ?? null,
    payload: payload ? sanitizeWebhookValueForLog(payload) : null,
    fullAttachment: sanitizeWebhookValueForLog(attachment)
  };
};

const attachmentTypeMatches = (
  attachmentRaw: unknown,
  matcher: RegExp
): boolean => {
  const attachment = asRecord(attachmentRaw);
  const type =
    typeof attachment?.type === "string" ? attachment.type.toLowerCase() : "";
  return matcher.test(type);
};

const payloadContainsPattern = (
  attachmentRaw: unknown,
  matcher: RegExp
): boolean => {
  const attachment = asRecord(attachmentRaw);
  const payload = asRecord(attachment?.payload);
  if (!payload) {
    return false;
  }

  const serialized = JSON.stringify(payload);
  return matcher.test(serialized);
};

const extractShareSectionFromAttachments = (
  attachments: unknown[],
  matcher: RegExp
): Record<string, unknown> => {
  const matched = attachments.filter(
    item => attachmentTypeMatches(item, matcher) || payloadContainsPattern(item, matcher)
  );

  return {
    attachmentTypes: matched.map(item => asRecord(item)?.type ?? null),
    attachments: matched
      .map(item => normalizeAttachmentForLog(item))
      .filter((item): item is Record<string, unknown> => Boolean(item)),
    payloads: matched
      .map(item => sanitizeWebhookValueForLog(asRecord(asRecord(item)?.payload)))
      .filter(Boolean)
  };
};

export const buildUnsupportedInstagramWebhookPayloadDetails = (
  parsed: ParsedInstagramWebhookEvent
): Record<string, unknown> => {
  const messagingItem = parsed.rawMessagingItem;
  const message = messagingItem ? asRecord(messagingItem.message) : null;
  const sender = messagingItem ? asRecord(messagingItem.sender) : null;
  const recipient = messagingItem ? asRecord(messagingItem.recipient) : null;
  const reaction = messagingItem ? asRecord(messagingItem.reaction) : null;
  const rawAttachments = Array.isArray(message?.attachments)
    ? message.attachments
    : [];
  const normalizedAttachments = rawAttachments
    .map(item => normalizeAttachmentForLog(item))
    .filter((item): item is Record<string, unknown> => Boolean(item));

  const storyPattern = /story|stories|story_mention|story_share|ig_story/i;
  const profilePattern = /profile|profile_share|ig_profile|username/i;
  const highlightPattern = /highlight|highlights|ig_highlight|reel_highlight/i;

  const messageShare = message?.share ?? null;
  const messageReferral = message?.referral ?? messagingItem?.referral ?? null;

  return {
    eventType: parsed.eventType,
    sender: {
      id: sender?.id ?? parsed.senderId ?? null
    },
    recipient: {
      id: recipient?.id ?? parsed.recipientId ?? null
    },
    message: {
      mid: message?.mid ?? parsed.messageId ?? null,
      text: message?.text ?? null,
      reply_to: message?.reply_to ?? null,
      referral: messageReferral
        ? sanitizeWebhookValueForLog(messageReferral)
        : null,
      share: messageShare ? sanitizeWebhookValueForLog(messageShare) : null
    },
    attachments: normalizedAttachments,
    attachmentTypes: normalizedAttachments.map(item => item.type ?? null),
    attachmentPayloads: normalizedAttachments.map(item => item.payload ?? null),
    reaction: reaction ? sanitizeWebhookValueForLog(reaction) : null,
    story: {
      messageShare: messageShare ? sanitizeWebhookValueForLog(messageShare) : null,
      messageReferral: messageReferral
        ? sanitizeWebhookValueForLog(messageReferral)
        : null,
      ...extractShareSectionFromAttachments(rawAttachments, storyPattern)
    },
    profile: {
      messageShare: messageShare ? sanitizeWebhookValueForLog(messageShare) : null,
      ...extractShareSectionFromAttachments(rawAttachments, profilePattern)
    },
    highlight: {
      messageShare: messageShare ? sanitizeWebhookValueForLog(messageShare) : null,
      ...extractShareSectionFromAttachments(rawAttachments, highlightPattern)
    },
    messagingItemKeys: messagingItem ? Object.keys(messagingItem) : [],
    messageKeys: message ? Object.keys(message) : [],
    normalizedRawPayload: sanitizeWebhookValueForLog(messagingItem),
    parsedContext: {
      object: parsed.object,
      entryId: parsed.entryId,
      instagramBusinessAccountId: parsed.instagramBusinessAccountId,
      timestamp: parsed.timestamp,
      attachmentsCount: parsed.attachmentsCount,
      hasText: parsed.hasText,
      textPreview: parsed.textPreview,
      isEcho: parsed.isEcho,
      replyToMessageId: parsed.replyToMessageId
    }
  };
};

export const logUnsupportedInstagramWebhookPayload = (
  parsed: ParsedInstagramWebhookEvent,
  log: { info: (obj: Record<string, unknown>, msg: string) => void }
): void => {
  log.info(
    summarizeUnsupportedInstagramWebhookPayload(parsed),
    "[InstagramWebhook] unsupported_payload"
  );
  log.info(
    buildUnsupportedInstagramWebhookPayloadDetails(parsed) as Record<string, unknown>,
    "[InstagramWebhook] unsupported_payload_details"
  );
};

export const summarizeUnsupportedInstagramWebhookPayload = (
  parsed: ParsedInstagramWebhookEvent
): Record<string, unknown> => {
  const message = parsed.rawMessagingItem
    ? asRecord(parsed.rawMessagingItem.message)
    : null;
  const sender = parsed.rawMessagingItem
    ? asRecord(parsed.rawMessagingItem.sender)
    : null;
  const recipient = parsed.rawMessagingItem
    ? asRecord(parsed.rawMessagingItem.recipient)
    : null;
  const rawAttachments = Array.isArray(message?.attachments)
    ? message.attachments
    : [];

  return {
    messageMid: parsed.messageId,
    senderId: sender?.id ?? parsed.senderId,
    recipientId: recipient?.id ?? parsed.recipientId,
    messageText: message?.text ?? null,
    messageReferral:
      message?.referral ?? parsed.rawMessagingItem?.referral ?? null,
    messageShare: message?.share ?? null,
    messageAttachments: rawAttachments.map(item => {
      const attachment = asRecord(item);
      return {
        type: attachment?.type ?? null,
        payload: asRecord(attachment?.payload)
      };
    }),
    attachmentTypes: rawAttachments.map(item => asRecord(item)?.type ?? null),
    eventType: parsed.eventType,
    hasText: parsed.hasText,
    textPreview: parsed.textPreview
  };
};

export const buildSafeWebhookLogSummary = (
  parsed: ParsedInstagramWebhookEvent,
  mappedAccountId: number | null,
  companyId: number | null,
  accountMapped: boolean
): Record<string, unknown> => ({
  object: parsed.object,
  eventType: parsed.eventType,
  instagramBusinessAccountId: parsed.instagramBusinessAccountId,
  entryId: parsed.entryId,
  senderId: parsed.senderId,
  recipientId: parsed.recipientId,
  messageId: parsed.messageId,
  hasText: parsed.hasText,
  attachmentsCount: parsed.attachmentsCount,
  mappedAccountId,
  companyId,
  accountMapped
});
