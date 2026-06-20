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
  shortcode: string | null;
}

export type InstagramSharePermalinkKind =
  | "post"
  | "reel"
  | "story"
  | "profile";

export interface ExtractedInstagramSharePermalink {
  permalink: string | null;
  shortcode: string | null;
  kind: InstagramSharePermalinkKind | null;
}

const SHORTCODE_FIELD_NAMES = [
  "shortcode",
  "media_shortcode",
  "share_shortcode",
  "ig_shortcode",
  "code"
] as const;

const SHORTCODE_VALUE_PATTERN = /^[A-Za-z0-9_-]{5,40}$/;

const isLikelyInstagramShortcode = (value: string): boolean => {
  if (!SHORTCODE_VALUE_PATTERN.test(value)) {
    return false;
  }

  if (/^\d+$/.test(value)) {
    return false;
  }

  return true;
};

const normalizeInstagramPermalink = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    if (!parsed.pathname.endsWith("/")) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.href;
  } catch {
    return url;
  }
};

export const extractShortcodeFromInstagramUrl = (
  url: string | null
): { shortcode: string; kind: InstagramSharePermalinkKind } | null => {
  if (!url || !isInstagramPublicLink(url)) {
    return null;
  }

  const patterns: Array<{
    regex: RegExp;
    kind: InstagramSharePermalinkKind;
  }> = [
    { regex: /instagram\.com\/reels?\/([A-Za-z0-9_-]+)/i, kind: "reel" },
    { regex: /instagram\.com\/(?:p|tv)\/([A-Za-z0-9_-]+)/i, kind: "post" },
    {
      regex: /instagram\.com\/stories\/[^/]+\/([A-Za-z0-9_-]+)/i,
      kind: "story"
    }
  ];

  for (const { regex, kind } of patterns) {
    const match = url.match(regex);
    const shortcode = match?.[1];
    if (shortcode && isLikelyInstagramShortcode(shortcode)) {
      return { shortcode, kind };
    }
  }

  return null;
};

const buildPermalinkFromShortcode = (
  shortcode: string,
  kind: InstagramSharePermalinkKind
): string | null => {
  if (!isLikelyInstagramShortcode(shortcode)) {
    return null;
  }

  switch (kind) {
    case "post":
      return normalizeInstagramPermalink(
        `https://www.instagram.com/p/${shortcode}/`
      );
    case "reel":
      return normalizeInstagramPermalink(
        `https://www.instagram.com/reel/${shortcode}/`
      );
    case "story":
      return null;
    case "profile":
      return normalizeInstagramPermalink(
        `https://www.instagram.com/${shortcode}/`
      );
    default:
      return null;
  }
};

const collectPayloadStringValues = (
  payload: Record<string, unknown>,
  depth = 0
): string[] => {
  if (depth > 4) {
    return [];
  }

  const values: string[] = [];

  for (const value of Object.values(payload)) {
    if (typeof value === "string" && value.trim()) {
      values.push(value.trim());
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      values.push(
        ...collectPayloadStringValues(value as Record<string, unknown>, depth + 1)
      );
    }
  }

  return values;
};

const inferPermalinkKindFromMediaType = (
  mediaType: string | null | undefined
): InstagramSharePermalinkKind => {
  switch (mediaType) {
    case "instagram_reel":
      return "reel";
    case "instagram_story":
      return "story";
    case "instagram_profile":
      return "profile";
    default:
      return "post";
  }
};

export const extractInstagramPermalinkFromSharePayload = (
  payload: Record<string, unknown> | null,
  mediaType?: string | null
): ExtractedInstagramSharePermalink => {
  if (!payload) {
    return { permalink: null, shortcode: null, kind: null };
  }

  const directUrlFields = [
    asString(payload.permalink),
    asString(payload.link),
    asString(payload.url),
    asString(payload.share_url),
    asString(payload.source_url)
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of directUrlFields) {
    if (isLookasideCdnUrl(candidate)) {
      continue;
    }

    if (isInstagramPublicLink(candidate)) {
      const parsedShortcode = extractShortcodeFromInstagramUrl(candidate);
      if (
        isInstagramPermalinkUrl(candidate) ||
        isInstagramProfileLink(candidate)
      ) {
        return {
          permalink: normalizeInstagramPermalink(candidate),
          shortcode: parsedShortcode?.shortcode ?? null,
          kind: parsedShortcode?.kind ?? null
        };
      }
    }
  }

  for (const fieldName of SHORTCODE_FIELD_NAMES) {
    const shortcode = asString(payload[fieldName]);
    if (!shortcode || !isLikelyInstagramShortcode(shortcode)) {
      continue;
    }

    const kind = inferPermalinkKindFromMediaType(mediaType);
    const permalink = buildPermalinkFromShortcode(shortcode, kind);
    if (permalink) {
      return { permalink, shortcode, kind };
    }
  }

  for (const candidate of collectPayloadStringValues(payload)) {
    if (isLookasideCdnUrl(candidate)) {
      continue;
    }

    const parsedShortcode = extractShortcodeFromInstagramUrl(candidate);
    if (parsedShortcode) {
      const permalink = buildPermalinkFromShortcode(
        parsedShortcode.shortcode,
        parsedShortcode.kind
      );
      if (permalink) {
        return {
          permalink,
          shortcode: parsedShortcode.shortcode,
          kind: parsedShortcode.kind
        };
      }
    }
  }

  return { permalink: null, shortcode: null, kind: null };
};

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
  payload: Record<string, unknown> | null,
  ...candidates: Array<string | null | undefined>
): ClassifiedShareUrls => {
  let permalink: string | null = null;
  let assetUrl: string | null = null;
  let rawUrl: string | null = null;
  let shortcode: string | null = null;

  for (const candidate of candidates) {
    const url = asString(candidate);
    if (!url) {
      continue;
    }

    if (isInstagramPublicLink(url) && !isLookasideCdnUrl(url)) {
      if (isInstagramPermalinkUrl(url) || isInstagramProfileLink(url)) {
        permalink = permalink || normalizeInstagramPermalink(url);
        const parsedShortcode = extractShortcodeFromInstagramUrl(url);
        shortcode = shortcode || parsedShortcode?.shortcode || null;
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
    thumbnailSourceUrl:
      extractShareThumbnailUrlFromPayload(payload) || assetUrl,
    assetId,
    shortcode
  };
};

const THUMBNAIL_URL_FIELD_NAMES = [
  "thumbnail_url",
  "preview_url",
  "image_url",
  "cover_url",
  "picture",
  "thumb_url",
  "thumbnailUrl",
  "previewUrl",
  "imageUrl",
  "coverUrl"
] as const;

const IMAGE_FILE_PATTERN = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i;

export const isShareThumbnailSourceUrl = (url: string | null): boolean => {
  if (!url || !/^https?:\/\//i.test(url)) {
    return false;
  }

  if (isInstagramPermalinkUrl(url) || isInstagramPublicLink(url)) {
    return false;
  }

  if (isDirectVideoMediaUrl(url, null)) {
    return false;
  }

  if (isLookasideCdnUrl(url)) {
    return true;
  }

  if (IMAGE_FILE_PATTERN.test(url)) {
    return true;
  }

  return /(?:fbcdn|cdninstagram|scontent)/i.test(url);
};

export const extractShareThumbnailCandidatesFromPayload = (
  payload: Record<string, unknown> | null
): Record<string, string | null> => {
  const candidates: Record<string, string | null> = {
    thumbnail_url: null,
    preview_url: null,
    image_url: null,
    media_url: null,
    cover_url: null
  };

  if (!payload) {
    return candidates;
  }

  candidates.thumbnail_url =
    asString(payload.thumbnail_url) || asString(payload.thumbnailUrl);
  candidates.preview_url =
    asString(payload.preview_url) || asString(payload.previewUrl);
  candidates.image_url =
    asString(payload.image_url) || asString(payload.imageUrl);
  candidates.media_url = asString(payload.media_url) || asString(payload.mediaUrl);
  candidates.cover_url =
    asString(payload.cover_url) || asString(payload.coverUrl);

  if (!candidates.image_url) {
    candidates.image_url = asString(payload.picture);
  }

  const scanPayloadValues = (
    record: Record<string, unknown>,
    depth = 0
  ): void => {
    if (depth > 4) {
      return;
    }

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === "string" && value.trim()) {
        if (/thumbnail|preview|cover|image_url|picture|thumb/i.test(key)) {
          if (/thumbnail/i.test(key) && !candidates.thumbnail_url) {
            candidates.thumbnail_url = value.trim();
          }
          if (/preview/i.test(key) && !candidates.preview_url) {
            candidates.preview_url = value.trim();
          }
          if (/cover/i.test(key) && !candidates.cover_url) {
            candidates.cover_url = value.trim();
          }
          if (/image/i.test(key) && !candidates.image_url) {
            candidates.image_url = value.trim();
          }
        }
        continue;
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        scanPayloadValues(value as Record<string, unknown>, depth + 1);
      }
    }
  };

  scanPayloadValues(payload);

  return candidates;
};

export const extractShareThumbnailUrlFromPayload = (
  payload: Record<string, unknown> | null
): string | null => {
  const candidates = extractShareThumbnailCandidatesFromPayload(payload);
  const orderedCandidates = [
    candidates.thumbnail_url,
    candidates.preview_url,
    candidates.cover_url,
    candidates.image_url,
    candidates.media_url
  ];

  for (const candidate of orderedCandidates) {
    if (candidate && isShareThumbnailSourceUrl(candidate)) {
      return candidate;
    }
  }

  return null;
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
