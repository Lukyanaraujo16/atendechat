import path from "path";

/**
 * Normaliza legenda de mídia do AI Agent (Fase 2.17.1B).
 * Marcadores técnicos do listener / placeholders nunca contam como caption real.
 */
const MEDIA_CAPTION_PLACEHOLDERS = new Set([
  "-",
  "Áudio",
  "Imagem",
  "sticker",
  "reaction",
  "audio",
  "image"
]);

export type NormalizeAiAgentMediaCaptionOptions = {
  /** mediaUrl relativo ou filename persistido — evita tratar nome do arquivo como legenda. */
  mediaUrlOrFilename?: string | null;
};

function extractMediaBasename(
  mediaUrlOrFilename: string | null | undefined
): string | null {
  const raw = String(mediaUrlOrFilename || "").trim();
  if (!raw) return null;

  let relative = raw;
  if (/^https?:\/\//i.test(raw)) {
    const marker = "/public/";
    const idx = raw.indexOf(marker);
    if (idx >= 0) {
      relative = decodeURIComponent(raw.slice(idx + marker.length));
    } else {
      try {
        relative = path.basename(new URL(raw).pathname);
      } catch {
        relative = path.basename(raw);
      }
    }
  }

  const base = path.basename(relative).trim();
  return base || null;
}

/**
 * Retorna legenda útil do cliente ou `null` quando ausente/técnica.
 * Não remove legendas reais escritas pelo usuário.
 */
export function normalizeAiAgentMediaCaption(
  raw: string | null | undefined,
  options?: NormalizeAiAgentMediaCaptionOptions
): string | null {
  if (raw == null) return null;
  const t = String(raw).trim();
  if (!t) return null;

  if (MEDIA_CAPTION_PLACEHOLDERS.has(t)) return null;
  if (/^\[[^\]]+\]$/.test(t)) return null;
  if (t.startsWith("[Conteúdo:") || t.startsWith("[Mídia:")) return null;

  const basename = extractMediaBasename(options?.mediaUrlOrFilename);
  if (basename) {
    if (t === basename) return null;
    const withoutExt = basename.replace(/\.[^.]+$/, "");
    if (withoutExt && t === withoutExt) return null;
    // Mesmo critério do listener: body embutido como `title.ext` no filename ≠ caption.
    const ext = path.extname(basename);
    if (ext && basename.includes(`${t}${ext}`)) return null;
  }

  return t;
}
