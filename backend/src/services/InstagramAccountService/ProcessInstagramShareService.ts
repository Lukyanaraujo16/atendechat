import { logger } from "../../utils/logger";
import {
  InstagramWebhookAttachment,
  ParsedInstagramWebhookEvent
} from "./InstagramWebhookParser";
import {
  extractShareUrlFromPayload,
  isInstagramPermalinkUrl,
  isInstagramShareAttachmentType,
  shouldTreatAttachmentAsShare
} from "./instagramShareUtils";

export type InstagramShareMediaType =
  | "instagram_post"
  | "instagram_reel"
  | "instagram_story"
  | "instagram_profile";

export interface InstagramShareMessageContent {
  body: string;
  mediaType: InstagramShareMediaType;
  mediaUrl: string | null;
  shareMeta: Record<string, unknown>;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const inferShareFromUrl = (
  url: string | null
): {
  mediaType: InstagramShareMediaType;
  postId?: string;
  reelId?: string;
  storyId?: string;
  username?: string;
} | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();

    if (pathname.includes("/reel/") || pathname.includes("/reels/")) {
      const reelId = pathname.split("/").filter(Boolean).pop() || undefined;
      return { mediaType: "instagram_reel", reelId };
    }

    if (pathname.includes("/stories/")) {
      const parts = pathname.split("/").filter(Boolean);
      const storyId = parts[parts.length - 1];
      const username = parts[0] === "stories" ? parts[1] : parts[0];
      return { mediaType: "instagram_story", storyId, username };
    }

    if (pathname.includes("/p/") || pathname.includes("/tv/")) {
      const postId = pathname.split("/").filter(Boolean).pop() || undefined;
      return { mediaType: "instagram_post", postId };
    }

    const segments = pathname.split("/").filter(Boolean);
    if (
      segments.length === 1 &&
      !["p", "reel", "reels", "stories", "explore", "tv"].includes(segments[0])
    ) {
      return { mediaType: "instagram_profile", username: segments[0] };
    }
  } catch {
    return null;
  }

  return null;
};

const mapAttachmentTypeToShare = (
  attachmentType: string
): InstagramShareMediaType | null => {
  switch (attachmentType) {
    case "post_share":
    case "ig_post":
      return "instagram_post";
    case "reel_share":
    case "ig_reel":
      return "instagram_reel";
    case "story_share":
    case "story_mention":
      return "instagram_story";
    case "profile_share":
      return "instagram_profile";
    default:
      return null;
  }
};

const inferShareFromPayloadIds = (
  attachmentType: string,
  payload: Record<string, unknown>
): InstagramShareMediaType | null => {
  if (payload.reel_video_id || payload.ig_reel_media_id) {
    return "instagram_reel";
  }

  if (payload.ig_post_media_id || payload.media_id || payload.post_id) {
    return "instagram_post";
  }

  if (attachmentType === "ig_post") {
    return "instagram_post";
  }

  if (attachmentType === "ig_reel") {
    return "instagram_reel";
  }

  if (attachmentType === "share" || attachmentType === "media_share") {
    return "instagram_post";
  }

  return null;
};

const buildShareBody = (mediaType: InstagramShareMediaType): string => {
  switch (mediaType) {
    case "instagram_post":
      return "Post compartilhado";
    case "instagram_reel":
      return "Reel compartilhado";
    case "instagram_story":
      return "Story compartilhado";
    case "instagram_profile":
      return "Perfil compartilhado";
    default:
      return "Conteúdo compartilhado do Instagram";
  }
};

const buildShareContent = ({
  attachmentType,
  payload,
  url,
  caption,
  source
}: {
  attachmentType: string;
  payload: Record<string, unknown>;
  url: string | null;
  caption: string | null;
  source: string;
}): InstagramShareMessageContent | null => {
  const explicitType = mapAttachmentTypeToShare(attachmentType);
  const inferred = inferShareFromUrl(url);
  const mediaType =
    explicitType || inferred?.mediaType || inferShareFromPayloadIds(attachmentType, payload);

  if (!mediaType) {
    return null;
  }

  const username =
    asString(payload.username) ||
    asString(payload.profile_username) ||
    inferred?.username ||
    null;
  const postId =
    asString(payload.post_id) ||
    asString(payload.ig_post_media_id) ||
    asString(payload.media_id) ||
    inferred?.postId ||
    null;
  const reelId =
    asString(payload.reel_id) ||
    asString(payload.reel_video_id) ||
    asString(payload.ig_reel_media_id) ||
    inferred?.reelId ||
    null;
  const storyId = asString(payload.story_id) || inferred?.storyId || null;
  const profileId = asString(payload.profile_id) || asString(payload.ig_id) || null;
  const title = asString(payload.title) || caption;
  const permalink = isInstagramPermalinkUrl(url) ? url : url;

  const shareMeta = {
    source,
    attachmentType,
    permalink: isInstagramPermalinkUrl(permalink) ? permalink : null,
    rawUrl: url,
    postId,
    reelId,
    storyId,
    username,
    profileId,
    title,
    payload
  };

  const logKey =
    mediaType === "instagram_post"
      ? "post"
      : mediaType === "instagram_reel"
        ? "reel"
        : mediaType === "instagram_story"
          ? "story"
          : "profile";

  logger.info(
    {
      source,
      attachmentType,
      mediaType,
      permalink: shareMeta.permalink,
      postId,
      reelId,
      storyId,
      username,
      profileId
    },
    `[InstagramShare] ${logKey}`
  );

  return {
    body: buildShareBody(mediaType),
    mediaType,
    mediaUrl: (shareMeta.permalink as string | null) || null,
    shareMeta
  };
};

const ProcessInstagramShareService = (
  attachment: InstagramWebhookAttachment,
  caption: string | null
): InstagramShareMessageContent | null => {
  if (!shouldTreatAttachmentAsShare(attachment)) {
    return null;
  }

  const payload = attachment.payload || {};
  const url = extractShareUrlFromPayload(attachment.url, payload);

  return buildShareContent({
    attachmentType: attachment.type,
    payload,
    url,
    caption,
    source: "attachment"
  });
};

export const resolveInstagramShareFromMessageLevel = (
  parsed: ParsedInstagramWebhookEvent,
  caption: string | null
): InstagramShareMessageContent | null => {
  const message = parsed.rawMessagingItem
    ? asRecord(parsed.rawMessagingItem.message)
    : null;

  const messageShare = asRecord(message?.share);
  if (messageShare) {
    const url =
      asString(messageShare.link) ||
      asString(messageShare.url) ||
      asString(messageShare.permalink);
    const content = buildShareContent({
      attachmentType: "share",
      payload: messageShare,
      url,
      caption: asString(messageShare.share_text) || caption,
      source: "message.share"
    });
    if (content) {
      return content;
    }
  }

  const referral =
    asRecord(parsed.rawMessagingItem?.referral) || asRecord(message?.referral);
  if (referral) {
    const url = asString(referral.link) || asString(referral.source_url);
    const content = buildShareContent({
      attachmentType: "referral",
      payload: referral,
      url,
      caption,
      source: "message.referral"
    });
    if (content) {
      return content;
    }
  }

  return null;
};

export const resolveInstagramShareContent = (
  parsed: ParsedInstagramWebhookEvent,
  caption: string | null
): InstagramShareMessageContent | null => {
  const fromMessageLevel = resolveInstagramShareFromMessageLevel(parsed, caption);
  if (fromMessageLevel) {
    return fromMessageLevel;
  }

  const attachments = parsed.rawMessagingItem
    ? (() => {
        const message = asRecord(parsed.rawMessagingItem?.message);
        const raw = Array.isArray(message?.attachments) ? message.attachments : [];
        return raw
          .map(item => {
            const record = asRecord(item);
            if (!record) return null;
            const payload = asRecord(record.payload);
            const url =
              typeof payload?.url === "string" && payload.url.trim()
                ? payload.url.trim()
                : null;
            const type =
              typeof record.type === "string"
                ? record.type.toLowerCase()
                : "unknown";
            return { type, url, payload };
          })
          .filter((item): item is InstagramWebhookAttachment => Boolean(item));
      })()
    : [];

  for (const attachment of attachments) {
    const content = ProcessInstagramShareService(attachment, caption);
    if (content) {
      return content;
    }
  }

  return null;
};

export { isInstagramShareAttachmentType, shouldTreatAttachmentAsShare };

export default ProcessInstagramShareService;
