/**
 * Limites de mídia Evolution (Fase 7).
 * Alinhados a Instagram inbound + AI agent caps do projeto.
 */
export const EVOLUTION_MEDIA_LIMITS = {
  imageMaxBytes: 8 * 1024 * 1024,
  videoMaxBytes: 25 * 1024 * 1024,
  audioMaxBytes: 25 * 1024 * 1024,
  documentMaxBytes: 25 * 1024 * 1024,
  stickerMaxBytes: 2 * 1024 * 1024,
  /** Timeout HTTP para getBase64 / download URL. */
  downloadTimeoutMs: 30_000,
  /** Redirects HTTP máximos (só para hosts allowlisted). */
  maxRedirects: 3
} as const;

export type EvolutionBinaryMediaKind =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker";

export function maxBytesForEvolutionMediaKind(
  kind: EvolutionBinaryMediaKind
): number {
  switch (kind) {
    case "image":
      return EVOLUTION_MEDIA_LIMITS.imageMaxBytes;
    case "video":
      return EVOLUTION_MEDIA_LIMITS.videoMaxBytes;
    case "audio":
      return EVOLUTION_MEDIA_LIMITS.audioMaxBytes;
    case "document":
      return EVOLUTION_MEDIA_LIMITS.documentMaxBytes;
    case "sticker":
      return EVOLUTION_MEDIA_LIMITS.stickerMaxBytes;
    default:
      return EVOLUTION_MEDIA_LIMITS.documentMaxBytes;
  }
}
