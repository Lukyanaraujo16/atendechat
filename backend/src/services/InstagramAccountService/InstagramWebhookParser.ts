export interface ParsedInstagramWebhookEvent {
  object: string;
  entryId: string | null;
  instagramBusinessAccountId: string | null;
  senderId: string | null;
  recipientId: string | null;
  timestamp: number | null;
  messageId: string | null;
  eventType: string | null;
  hasText: boolean;
  textPreview: string | null;
  attachmentsCount: number;
  rawMessagingItem: Record<string, unknown> | null;
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
    instagramBusinessAccountId: recipientId || entryId,
    senderId,
    recipientId,
    timestamp: Number.isFinite(timestamp) ? timestamp : null,
    messageId,
    eventType: detectEventType(item),
    hasText: Boolean(message && typeof message.text === "string" && message.text),
    textPreview: message ? extractTextPreview(message) : null,
    attachmentsCount: attachments.length,
    rawMessagingItem: item
  };
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
        eventType:
          typeof change.field === "string" ? `change:${change.field}` : "change",
        hasText: false,
        textPreview: null,
        attachmentsCount: 0,
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
      eventType: "payload",
      hasText: false,
      textPreview: null,
      attachmentsCount: 0,
      rawMessagingItem: null
    });
  }

  return parsed;
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
