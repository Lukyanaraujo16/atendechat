import { InstagramWebhookAttachment } from "./InstagramWebhookParser";

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const INSTAGRAM_PERMALINK_PATTERN =
  /instagram\.com\/(p\/|reel\/|reels\/|tv\/|stories\/)/i;

const DIRECT_VIDEO_FILE_PATTERN = /\.(mp4|mov|webm|m4v)(\?|$)/i;
const DIRECT_VIDEO_CDN_PATTERN =
  /(?:fbcdn|cdninstagram|scontent|video\.|\.mp4|mime=video)/i;

export const extractShareUrlFromPayload = (
  url: string | null,
  payload: Record<string, unknown> | null
): string | null => {
  const candidates = [
    url,
    asString(payload?.url),
    asString(payload?.link),
    asString(payload?.permalink),
    asString(payload?.share_url)
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return candidate;
    }
  }

  return null;
};

export const isInstagramPermalinkUrl = (url: string | null): boolean => {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("instagram.com")) {
      return false;
    }
    return INSTAGRAM_PERMALINK_PATTERN.test(parsed.href);
  } catch {
    return INSTAGRAM_PERMALINK_PATTERN.test(url);
  }
};

export const isDirectVideoMediaUrl = (
  url: string | null,
  payload: Record<string, unknown> | null = null
): boolean => {
  const candidate = extractShareUrlFromPayload(url, payload);
  if (!candidate) {
    return false;
  }

  if (isInstagramPermalinkUrl(candidate)) {
    return false;
  }

  if (DIRECT_VIDEO_FILE_PATTERN.test(candidate)) {
    return true;
  }

  return DIRECT_VIDEO_CDN_PATTERN.test(candidate);
};

const SHARE_ATTACHMENT_TYPES = new Set([
  "share",
  "story_mention",
  "template",
  "post_share",
  "reel_share",
  "story_share",
  "profile_share",
  "ig_post",
  "media_share"
]);

export const isInstagramShareAttachmentType = (type: string): boolean =>
  SHARE_ATTACHMENT_TYPES.has(type);

export const shouldTreatAttachmentAsShare = (
  attachment: InstagramWebhookAttachment
): boolean => {
  if (isInstagramShareAttachmentType(attachment.type)) {
    return true;
  }

  if (attachment.type === "ig_post") {
    return true;
  }

  if (attachment.type === "ig_reel") {
    const shareUrl = extractShareUrlFromPayload(
      attachment.url,
      attachment.payload
    );
    if (isInstagramPermalinkUrl(shareUrl)) {
      return true;
    }

    const payload = attachment.payload || {};
    if (
      payload.reel_video_id ||
      payload.ig_reel_media_id ||
      payload.media_id
    ) {
      return !isDirectVideoMediaUrl(shareUrl, attachment.payload);
    }

    return !isDirectVideoMediaUrl(shareUrl, attachment.payload);
  }

  if (attachment.type === "share") {
    return true;
  }

  const shareUrl = extractShareUrlFromPayload(
    attachment.url,
    attachment.payload
  );
  return isInstagramPermalinkUrl(shareUrl);
};

export const isPlayableVideoAttachment = (
  attachment: InstagramWebhookAttachment
): boolean => {
  if (attachment.type === "video") {
    return true;
  }

  if (attachment.type === "ig_reel") {
    return isDirectVideoMediaUrl(attachment.url, attachment.payload);
  }

  return false;
};
