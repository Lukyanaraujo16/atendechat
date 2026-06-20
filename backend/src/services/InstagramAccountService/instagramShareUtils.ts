import { InstagramWebhookAttachment } from "./InstagramWebhookParser";

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const INSTAGRAM_PERMALINK_PATTERN =
  /instagram\.com\/(p\/|reel\/|reels\/|tv\/|stories\/)/i;

const LOOKASIDE_CDN_PATTERN = /lookaside\.fbsbx\.com|ig_messaging_cdn/i;

export interface ClassifiedShareUrls {
  permalink: string | null;
  rawUrl: string | null;
  assetUrl: string | null;
  thumbnailSourceUrl: string | null;
  assetId: string | null;
}

export const isLookasideCdnUrl = (url: string | null): boolean => {
  if (!url) {
    return false;
  }

  try {
    return LOOKASIDE_CDN_PATTERN.test(new URL(url).href);
  } catch {
    return LOOKASIDE_CDN_PATTERN.test(url);
  }
};

export const isInstagramPermalink = (url: string | null): boolean =>
  isInstagramPermalinkUrl(url);

export const isInstagramPublicLink = (url: string | null): boolean => {
  if (!url || isLookasideCdnUrl(url)) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("instagram.com");
  } catch {
    return /instagram\.com/i.test(url) && !isLookasideCdnUrl(url);
  }
};

export const extractLookasideAssetId = (url: string | null): string | null => {
  if (!url || !isLookasideCdnUrl(url)) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const fromQuery =
      parsed.searchParams.get("asset_id") ||
      parsed.searchParams.get("assetId") ||
      parsed.searchParams.get("assetid");
    if (fromQuery) {
      return fromQuery;
    }
  } catch {
    // fall through to regex
  }

  const match = url.match(/asset_id(?:=|%3D|:)([^&%]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
};

export const collectShareUrlCandidates = (
  primaryUrl: string | null,
  payload: Record<string, unknown> | null
): string[] => {
  const candidates = [
    primaryUrl,
    asString(payload?.url),
    asString(payload?.link),
    asString(payload?.permalink),
    asString(payload?.share_url)
  ].filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set(candidates)];
};

export const classifyShareUrls = (
  ...candidates: Array<string | null | undefined>
): ClassifiedShareUrls => {
  let permalink: string | null = null;
  let assetUrl: string | null = null;
  let rawUrl: string | null = null;

  for (const candidate of candidates) {
    const url = asString(candidate);
    if (!url) {
      continue;
    }

    if (isInstagramPublicLink(url) && !isLookasideCdnUrl(url)) {
      if (isInstagramPermalinkUrl(url) || isInstagramProfileLink(url)) {
        permalink = permalink || url;
      }
      rawUrl = rawUrl || url;
      continue;
    }

    if (isLookasideCdnUrl(url)) {
      assetUrl = assetUrl || url;
      rawUrl = rawUrl || url;
    } else if (/^https?:\/\//i.test(url)) {
      rawUrl = rawUrl || url;
    }
  }

  const assetId = extractLookasideAssetId(assetUrl || rawUrl);

  return {
    permalink,
    rawUrl,
    assetUrl,
    thumbnailSourceUrl: assetUrl,
    assetId
  };
};

const isInstagramProfileLink = (url: string): boolean => {
  if (!isInstagramPublicLink(url) || isInstagramPermalinkUrl(url)) {
    return false;
  }

  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    return (
      segments.length === 1 &&
      !["p", "reel", "reels", "stories", "explore", "tv"].includes(
        segments[0].toLowerCase()
      )
    );
  } catch {
    return false;
  }
};

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
    if (isInstagramPermalinkUrl(shareUrl) || isLookasideCdnUrl(shareUrl)) {
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
  return (
    isInstagramPermalinkUrl(shareUrl) ||
    isLookasideCdnUrl(shareUrl) ||
    attachment.type === "ig_post"
  );
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
