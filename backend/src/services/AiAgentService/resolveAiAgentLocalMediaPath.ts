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
  const byExt: Record<string, string> = {
    ".ogg": "audio/ogg",
    ".opus": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".mp4": "audio/mp4",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".aac": "audio/aac",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif"
  };
  if (byExt[ext]) return byExt[ext];
  const hint = String(mediaTypeHint || "").toLowerCase();
  if (hint === "audio") return "audio/ogg";
  if (hint === "image") return "image/jpeg";
  return "application/octet-stream";
}
