import fs from "fs";
import path from "path";
import { promisify } from "util";

const access = promisify(fs.access);

/**
 * Resolve arquivo local de Message.mediaUrl com proteção a path traversal / SSRF.
 * Aceita apenas paths relativos já persistidos sob public/.
 * Nunca busca URLs http(s) arbitrárias do cliente.
 */
export function getAiAgentPublicRoot(): string {
  return path.resolve(__dirname, "..", "..", "..", "public");
}

export function resolveAiAgentLocalMediaPath(
  mediaUrlRaw: string | null | undefined
): string | null {
  const raw = String(mediaUrlRaw || "").trim();
  if (!raw) return null;

  // Getter do model pode devolver URL absoluta — extrair filename relativo.
  let relative = raw;
  if (/^https?:\/\//i.test(raw)) {
    const marker = "/public/";
    const idx = raw.indexOf(marker);
    if (idx < 0) return null;
    relative = decodeURIComponent(raw.slice(idx + marker.length));
  }

  // Bloquear path absoluto e traversal
  if (path.isAbsolute(relative)) return null;
  if (relative.includes("\0")) return null;
  if (/(^|[\\/])\.\.([\\/]|$)/.test(relative)) return null;
  const normalized = path.normalize(relative);
  if (
    normalized.startsWith("..") ||
    path.isAbsolute(normalized) ||
    /(^|[\\/])\.\.([\\/]|$)/.test(normalized)
  ) {
    return null;
  }

  const root = getAiAgentPublicRoot();
  const absolute = path.resolve(root, normalized);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (absolute !== root && !absolute.startsWith(rootWithSep)) {
    return null;
  }
  return absolute;
}

export async function assertAiAgentLocalMediaReadable(
  absolutePath: string
): Promise<boolean> {
  try {
    await access(absolutePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function guessMimeFromFilename(
  filename: string,
  mediaTypeHint?: string | null
): string {
  const ext = path.extname(filename).toLowerCase();
  // mime-types mapeia audio/ogg → .oga (primeiro); WhatsApp PTT costuma gravar .oga
  const byExt: Record<string, string> = {
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".opus": "audio/ogg",
    ".spx": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".mpga": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".m4a": "audio/mp4",
    ".mp4a": "audio/mp4",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".weba": "audio/webm",
    ".aac": "audio/aac",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif"
  };
  if (byExt[ext]) return byExt[ext];
  const hint = String(mediaTypeHint || "").toLowerCase();
  if (hint === "audio" || hint.startsWith("audio/")) return "audio/ogg";
  if (hint === "image" || hint.startsWith("image/")) return "image/jpeg";
  return "application/octet-stream";
}

/** Extensões aceitas pelo Whisper; usada para multipart filename. */
const WHISPER_SAFE_EXTS = new Set([
  ".flac",
  ".m4a",
  ".mp3",
  ".mp4",
  ".mpeg",
  ".mpga",
  ".oga",
  ".ogg",
  ".wav",
  ".webm"
]);

/**
 * Nome de arquivo com extensão que o Whisper reconhece.
 * Não altera o path de leitura — só o filename do multipart.
 */
export function resolveWhisperUploadFilename(
  absolutePath: string,
  mimeType?: string | null
): string {
  const base = path.basename(absolutePath) || "audio";
  const ext = path.extname(base).toLowerCase();
  if (WHISPER_SAFE_EXTS.has(ext)) return base;

  const mime = String(mimeType || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  const byMime: Record<string, string> = {
    "audio/ogg": "audio.ogg",
    "audio/opus": "audio.ogg",
    "application/ogg": "audio.ogg",
    "audio/mpeg": "audio.mp3",
    "audio/mp3": "audio.mp3",
    "audio/mp4": "audio.m4a",
    "audio/m4a": "audio.m4a",
    "audio/wav": "audio.wav",
    "audio/x-wav": "audio.wav",
    "audio/webm": "audio.webm",
    "audio/aac": "audio.m4a"
  };
  return byMime[mime] || "audio.ogg";
}
