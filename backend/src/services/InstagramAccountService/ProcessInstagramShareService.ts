import { logger } from "../../utils/logger";
import { InstagramWebhookAttachment } from "./InstagramWebhookParser";

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

const SHARE_ATTACHMENT_TYPES = new Set([
  "share",
  "story_mention",
  "template",
  "post_share",
  "reel_share",
  "story_share",
  "profile_share"
]);

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const inferShareFromUrl = (
  url: string | null
): { mediaType: InstagramShareMediaType; postId?: string; reelId?: string; storyId?: string; username?: string } | null => {
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
    if (segments.length === 1 && !["p", "reel", "reels", "stories", "explore"].includes(segments[0])) {
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
      return "instagram_post";
    case "reel_share":
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

const buildShareBody = (
  mediaType: InstagramShareMediaType,
  title: string | null,
  username: string | null
): string => {
  switch (mediaType) {
    case "instagram_post":
      return title ? `📸 Post compartilhado: ${title}` : "📸 Post compartilhado";
    case "instagram_reel":
      return title ? `🎬 Reel compartilhado: ${title}` : "🎬 Reel compartilhado";
    case "instagram_story":
      return "📱 Story compartilhado";
    case "instagram_profile":
      return username ? `👤 Perfil compartilhado: @${username.replace(/^@/, "")}` : "👤 Perfil compartilhado";
    default:
      return "Conteúdo compartilhado";
  }
};

const ProcessInstagramShareService = (
  attachment: InstagramWebhookAttachment,
  caption: string | null
): InstagramShareMessageContent | null => {
  if (!SHARE_ATTACHMENT_TYPES.has(attachment.type)) {
    return null;
  }

  const payload = attachment.payload || {};
  const url = attachment.url || asString(payload.url);
  const title = asString(payload.title) || caption;
  const explicitType = mapAttachmentTypeToShare(attachment.type);
  const inferred = inferShareFromUrl(url);
  const mediaType = explicitType || inferred?.mediaType;

  if (!mediaType) {
    return null;
  }

  const username =
    asString(payload.username) ||
    asString(payload.profile_username) ||
    inferred?.username ||
    null;
  const postId = asString(payload.post_id) || asString(payload.id) || inferred?.postId || null;
  const reelId = asString(payload.reel_id) || inferred?.reelId || null;
  const storyId = asString(payload.story_id) || inferred?.storyId || null;
  const profileId = asString(payload.profile_id) || asString(payload.ig_id) || null;
  const permalink = url;

  const shareMeta = {
    attachmentType: attachment.type,
    permalink,
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
      attachmentType: attachment.type,
      mediaType,
      permalink,
      postId,
      reelId,
      storyId,
      username,
      profileId
    },
    `[InstagramShare] ${logKey}`
  );

  return {
    body: buildShareBody(mediaType, title, username),
    mediaType,
    mediaUrl: permalink,
    shareMeta
  };
};

export const isInstagramShareAttachmentType = (type: string): boolean =>
  SHARE_ATTACHMENT_TYPES.has(type);

export default ProcessInstagramShareService;
