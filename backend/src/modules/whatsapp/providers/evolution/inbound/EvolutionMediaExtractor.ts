import { extension as mimeExtension } from "mime-types";
import { logger } from "../../../../../utils/logger";
import {
  EvolutionBinaryMediaKind,
  maxBytesForEvolutionMediaKind
} from "./evolutionMediaLimits";
import {
  EvolutionHttpError,
  evolutionDownloadMediaFromUrl,
  evolutionGetBase64FromMediaMessage
} from "./evolutionHttpClient";
import { EvolutionWebhookEnvelope } from "./evolutionWebhookTypes";

export type EvolutionExtractedMedia = {
  data: Buffer;
  mimetype: string;
  filename: string;
  kind: EvolutionBinaryMediaKind;
};

export type EvolutionMediaExtractHints = {
  kind: EvolutionBinaryMediaKind;
  messageId: string;
  mimetype: string | null;
  filename: string | null;
  /** base64 inline do webhook (webhookBase64=true), se presente */
  inlineBase64?: string | null;
  /** URL de mídia no payload, se presente */
  mediaUrl?: string | null;
};

function stripDataUrlPrefix(b64: string): string {
  const m = b64.match(/^data:[^;]+;base64,(.+)$/i);
  return m ? m[1] : b64;
}

export function decodeEvolutionBase64(raw: string, maxBytes: number): Buffer {
  const cleaned = stripDataUrlPrefix(String(raw || "").replace(/\s/g, ""));
  if (!cleaned) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_BASE64_INVALID",
      "base64 vazio"
    );
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(cleaned, "base64");
  } catch {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_BASE64_INVALID",
      "base64 inválido"
    );
  }
  // Buffer.from com base64 inválido ainda pode produzir bytes; rejeitar se
  // a string não decodifica de forma plausível (muito curta vs input).
  if (!buf.length) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_BASE64_INVALID",
      "base64 decodificou vazio"
    );
  }
  if (buf.length > maxBytes) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_TOO_LARGE",
      "base64 excede limite"
    );
  }
  return buf;
}

function buildFilename(
  hintName: string | null,
  mimetype: string,
  messageId: string
): string {
  if (hintName && hintName.trim() && !hintName.includes("..")) {
    return hintName.trim().replace(/[/\\]/g, "_");
  }
  const ext = mimeExtension(mimetype) || "bin";
  const safeId =
    messageId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "media";
  return `${Date.now()}_${safeId}.${ext}`;
}

function pickInlineBase64FromMessageNode(
  node: Record<string, unknown> | null | undefined
): string | null {
  if (!node) return null;
  const candidates = [
    node.base64,
    node.mediaBase64,
    node.fileBase64,
    typeof node.url === "string" && String(node.url).startsWith("data:")
      ? node.url
      : null
  ];
  const hit = candidates.find(
    (c): c is string => typeof c === "string" && Boolean(c.trim())
  );
  return hit ? hit.trim() : null;
}

function pickMediaUrlFromMessageNode(
  node: Record<string, unknown> | null | undefined
): string | null {
  if (!node) return null;
  const key = ["url", "mediaUrl", "directPath"].find(k => {
    const v = node[k];
    return typeof v === "string" && /^https?:\/\//i.test(v.trim());
  });
  return key ? String(node[key]).trim() : null;
}

function isDirectDownloadNotEligible(err: unknown): boolean {
  return (
    err instanceof EvolutionHttpError &&
    err.code === "ERR_EVOLUTION_MEDIA_URL_BLOCKED"
  );
}

function fallbackMime(kind: EvolutionBinaryMediaKind): string {
  switch (kind) {
    case "image":
      return "image/jpeg";
    case "video":
      return "video/mp4";
    case "audio":
      return "audio/ogg";
    case "sticker":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}

export function collectEvolutionMediaHints(input: {
  kind: EvolutionBinaryMediaKind;
  messageId: string;
  messageNode: Record<string, unknown> | null;
  mimetype: string | null;
  filename: string | null;
}): EvolutionMediaExtractHints {
  return {
    kind: input.kind,
    messageId: input.messageId,
    mimetype: input.mimetype,
    filename: input.filename,
    inlineBase64: pickInlineBase64FromMessageNode(input.messageNode),
    mediaUrl: pickMediaUrlFromMessageNode(input.messageNode)
  };
}

/**
 * Evolution payload/reference → buffer interno.
 * Ordem: inline base64 → download direto só se a URL passar na SSRF
 * (origem da Evolution) → POST /chat/getBase64FromMediaMessage/{instance}.
 * URL presente mas recusada pela SSRF NÃO aborta: só impede fetch direto.
 * Sem Baileys. Sem allowlist de CDN WhatsApp.
 */
export async function extractEvolutionMedia(input: {
  whatsappId: number;
  hints: EvolutionMediaExtractHints;
}): Promise<EvolutionExtractedMedia> {
  const maxBytes = maxBytesForEvolutionMediaKind(input.hints.kind);
  let buffer: Buffer | null = null;
  let mimetype = input.hints.mimetype || fallbackMime(input.hints.kind);

  if (input.hints.inlineBase64) {
    buffer = decodeEvolutionBase64(input.hints.inlineBase64, maxBytes);
  }

  if (!buffer && input.hints.mediaUrl) {
    try {
      buffer = await evolutionDownloadMediaFromUrl({
        whatsappId: input.whatsappId,
        mediaUrl: input.hints.mediaUrl,
        maxBytes
      });
    } catch (err) {
      if (!isDirectDownloadNotEligible(err)) {
        throw err;
      }
      logger.info(
        {
          whatsappId: input.whatsappId,
          messageId: input.hints.messageId,
          kind: input.hints.kind
        },
        "[EvolutionMedia] url_not_eligible_for_direct_download"
      );
    }
  }

  if (!buffer) {
    const api = await evolutionGetBase64FromMediaMessage({
      whatsappId: input.whatsappId,
      messageId: input.hints.messageId,
      convertToMp4: input.hints.kind === "video"
    });
    buffer = decodeEvolutionBase64(api.base64, maxBytes);
    if (api.mimetype) mimetype = api.mimetype;
  }

  if (!buffer || !buffer.length) {
    throw new EvolutionHttpError(
      "ERR_EVOLUTION_MEDIA_EMPTY",
      "Buffer de mídia Evolution vazio"
    );
  }

  return {
    data: buffer,
    mimetype,
    filename: buildFilename(
      input.hints.filename,
      mimetype,
      input.hints.messageId
    ),
    kind: input.hints.kind
  };
}

/** Helper para testes: lê nó de mídia do envelope. */
export function getEvolutionMessageMediaNode(
  envelope: EvolutionWebhookEnvelope,
  messageType: string
): Record<string, unknown> | null {
  const { data } = envelope;
  const msg = Array.isArray(data)
    ? data[0]?.message
    : (data as { message?: Record<string, unknown> } | undefined)?.message;
  if (!msg || typeof msg !== "object") return null;
  const node = (msg as Record<string, unknown>)[messageType];
  if (
    messageType === "documentWithCaptionMessage" &&
    node &&
    typeof node === "object"
  ) {
    const inner = (node as { message?: { documentMessage?: unknown } }).message
      ?.documentMessage;
    return inner && typeof inner === "object"
      ? (inner as Record<string, unknown>)
      : null;
  }
  return node && typeof node === "object"
    ? (node as Record<string, unknown>)
    : null;
}
