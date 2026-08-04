import fs from "fs";
import path from "path";
import { normalizeAiAgentMediaMimeType } from "../../config/aiModelMediaCapabilities";

export type AiAgentAudioContainer =
  | "ogg"
  | "webm"
  | "mp4"
  | "mpeg"
  | "wav"
  | "unknown";

export type AiAgentAudioFileInspection = {
  exists: boolean;
  isFile: boolean;
  readable: boolean;
  byteSize: number;
  extension: string;
  container: AiAgentAudioContainer;
  magicHex: string;
  normalizedMimeType: string;
};

function detectContainer(buf: Buffer): AiAgentAudioContainer {
  if (buf.length >= 4) {
    // OggS
    if (
      buf[0] === 0x4f &&
      buf[1] === 0x67 &&
      buf[2] === 0x67 &&
      buf[3] === 0x53
    ) {
      return "ogg";
    }
    // RIFF....WAVE
    if (
      buf.length >= 12 &&
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x41 &&
      buf[10] === 0x56 &&
      buf[11] === 0x45
    ) {
      return "wav";
    }
    // ID3 or MPEG frame sync
    if (
      (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
      (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    ) {
      return "mpeg";
    }
    // ftyp (MP4/M4A)
    if (
      buf.length >= 8 &&
      buf[4] === 0x66 &&
      buf[5] === 0x74 &&
      buf[6] === 0x79 &&
      buf[7] === 0x70
    ) {
      return "mp4";
    }
    // EBML (WebM)
    if (
      buf[0] === 0x1a &&
      buf[1] === 0x45 &&
      buf[2] === 0xdf &&
      buf[3] === 0xa3
    ) {
      return "webm";
    }
  }
  return "unknown";
}

function mimeForContainer(
  container: AiAgentAudioContainer,
  fallbackMime: string
): string {
  switch (container) {
    case "ogg":
      return "audio/ogg";
    case "webm":
      return "audio/webm";
    case "mp4":
      return "audio/mp4";
    case "mpeg":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    default:
      return normalizeAiAgentMediaMimeType(fallbackMime) || fallbackMime;
  }
}

/**
 * Inspeciona arquivo de áudio local sem ler o conteúdo completo.
 * Usa apenas magic bytes iniciais (máx. 16 bytes).
 */
export async function inspectAiAgentAudioFile(input: {
  absolutePath: string;
  mimeHint?: string | null;
}): Promise<AiAgentAudioFileInspection> {
  const absolutePath = String(input.absolutePath || "");
  const extension = path.extname(absolutePath).toLowerCase();
  const empty: AiAgentAudioFileInspection = {
    exists: false,
    isFile: false,
    readable: false,
    byteSize: 0,
    extension,
    container: "unknown",
    magicHex: "",
    normalizedMimeType: normalizeAiAgentMediaMimeType(input.mimeHint) || ""
  };

  try {
    await fs.promises.access(absolutePath, fs.constants.R_OK);
  } catch {
    return empty;
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(absolutePath);
  } catch {
    return empty;
  }

  if (!stat.isFile()) {
    return {
      ...empty,
      exists: true,
      isFile: false,
      readable: false,
      byteSize: stat.size
    };
  }

  let magic = Buffer.alloc(0);
  try {
    const fh = await fs.promises.open(absolutePath, "r");
    try {
      const buf = Buffer.alloc(16);
      const { bytesRead } = await fh.read(buf, 0, 16, 0);
      magic = buf.subarray(0, bytesRead);
    } finally {
      await fh.close();
    }
  } catch {
    return {
      ...empty,
      exists: true,
      isFile: true,
      readable: false,
      byteSize: stat.size
    };
  }

  const container = detectContainer(magic);
  return {
    exists: true,
    isFile: true,
    readable: true,
    byteSize: stat.size,
    extension,
    container,
    magicHex: magic.subarray(0, Math.min(8, magic.length)).toString("hex"),
    normalizedMimeType: mimeForContainer(
      container,
      normalizeAiAgentMediaMimeType(input.mimeHint) || "audio/ogg"
    )
  };
}

/**
 * Converte payload de mídia Baileys (Buffer/Uint8Array/base64 string) em Buffer binário.
 * Nunca aplica decodificação base64 sobre Buffer já binário.
 */
export function coerceWhatsAppMediaBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  if (typeof data === "string" && data.length > 0) {
    return Buffer.from(data, "base64");
  }
  throw new Error("INVALID_WHATSAPP_MEDIA_DATA");
}
