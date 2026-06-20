import path from "path";
import fs from "fs";
import { lookup } from "mime-types";

export const INSTAGRAM_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const parsedVideoMax = Number(process.env.INSTAGRAM_VIDEO_MAX_BYTES);
export const INSTAGRAM_VIDEO_MAX_BYTES =
  Number.isFinite(parsedVideoMax) && parsedVideoMax > 0
    ? parsedVideoMax
    : 25 * 1024 * 1024;

const parsedAudioMax = Number(process.env.INSTAGRAM_AUDIO_MAX_BYTES);
export const INSTAGRAM_AUDIO_MAX_BYTES =
  Number.isFinite(parsedAudioMax) && parsedAudioMax > 0
    ? parsedAudioMax
    : 25 * 1024 * 1024;

const parsedDocumentMax = Number(process.env.INSTAGRAM_DOCUMENT_MAX_BYTES);
export const INSTAGRAM_DOCUMENT_MAX_BYTES =
  Number.isFinite(parsedDocumentMax) && parsedDocumentMax > 0
    ? parsedDocumentMax
    : 25 * 1024 * 1024;

export const INSTAGRAM_ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp"
]);

export const INSTAGRAM_ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/quicktime"
]);

export const INSTAGRAM_ALLOWED_AUDIO_MIMES = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg"
]);

export const INSTAGRAM_ALLOWED_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv"
]);

export const INSTAGRAM_ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".txt",
  ".csv"
]);

export const INSTAGRAM_BLOCKED_DOCUMENT_EXTENSIONS = new Set([
  ".exe",
  ".apk",
  ".zip",
  ".rar",
  ".7z",
  ".iso",
  ".bat",
  ".sh"
]);

/** Formatos aceitos pela Meta para áudio outbound (Instagram Direct). */
export const INSTAGRAM_META_AUDIO_MIMES = new Set([
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/wav",
  "audio/x-wav"
]);

export const isInstagramMetaCompatibleAudioMime = (mime: string): boolean =>
  INSTAGRAM_META_AUDIO_MIMES.has(mime.toLowerCase());

export const needsInstagramAudioConversion = (mime: string): boolean =>
  !isInstagramMetaCompatibleAudioMime(mime);

export const assertInstagramMetaAudioFileSize = (bytes: number): void => {
  if (bytes > INSTAGRAM_AUDIO_MAX_BYTES) {
    throw new Error("ERR_INSTAGRAM_AUDIO_TOO_LARGE");
  }
};

const publicFolder = path.resolve(__dirname, "..", "..", "public");

export const isInstagramAllowedImageMime = (mime: string): boolean =>
  INSTAGRAM_ALLOWED_IMAGE_MIMES.has(mime.toLowerCase());

export const isInstagramAllowedVideoMime = (mime: string): boolean =>
  INSTAGRAM_ALLOWED_VIDEO_MIMES.has(mime.toLowerCase());

export const isInstagramAllowedAudioMime = (mime: string): boolean =>
  INSTAGRAM_ALLOWED_AUDIO_MIMES.has(mime.toLowerCase());

export const resolveInstagramDocumentExtension = (filename: string): string =>
  path.extname(filename || "").toLowerCase();

export const isInstagramAllowedDocumentMime = (mime: string): boolean =>
  INSTAGRAM_ALLOWED_DOCUMENT_MIMES.has(mime.toLowerCase());

export const isInstagramDocumentUpload = (file: Express.Multer.File): boolean => {
  const ext = resolveInstagramDocumentExtension(file.originalname);
  const mime = (file.mimetype || "").toLowerCase();
  return (
    INSTAGRAM_ALLOWED_DOCUMENT_EXTENSIONS.has(ext) ||
    INSTAGRAM_ALLOWED_DOCUMENT_MIMES.has(mime)
  );
};

export const getInstagramMediaMaxBytes = (mime: string | null): number => {
  if (mime && isInstagramAllowedVideoMime(mime)) {
    return INSTAGRAM_VIDEO_MAX_BYTES;
  }
  if (mime && isInstagramAllowedAudioMime(mime)) {
    return INSTAGRAM_AUDIO_MAX_BYTES;
  }
  if (mime && isInstagramAllowedDocumentMime(mime)) {
    return INSTAGRAM_DOCUMENT_MAX_BYTES;
  }
  if (mime && (mime.startsWith("text/") || mime === "application/pdf")) {
    return INSTAGRAM_DOCUMENT_MAX_BYTES;
  }
  return INSTAGRAM_IMAGE_MAX_BYTES;
};

export const getInstagramMediaDirectory = (companyId: number): string => {
  const dir = path.join(publicFolder, "instagram", String(companyId));
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.chmodSync(dir, 0o777);
  }
  return dir;
};

export const buildInstagramPublicMediaUrl = (relativePath: string): string => {
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  const normalized = relativePath.replace(/^\/+/, "");
  return `${base}/public/${normalized}`;
};

export const resolveExtensionFromMime = (mimeType: string | null): string => {
  if (!mimeType) {
    return ".jpg";
  }
  const ext = lookup(mimeType);
  if (typeof ext === "string" && ext.startsWith(".")) {
    return ext;
  }
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("gif")) return ".gif";
  if (mimeType.includes("webp")) return ".webp";
  if (mimeType.includes("quicktime")) return ".mov";
  if (mimeType.includes("mp4")) return ".mp4";
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.startsWith("video/")) return ".mp4";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("m4a") || mimeType.includes("aac")) return ".m4a";
  if (mimeType.startsWith("audio/")) return ".m4a";
  if (mimeType.includes("pdf")) return ".pdf";
  if (mimeType.includes("wordprocessingml")) return ".docx";
  if (mimeType.includes("msword")) return ".doc";
  if (mimeType.includes("spreadsheetml")) return ".xlsx";
  if (mimeType.includes("ms-excel")) return ".xls";
  if (mimeType === "text/plain") return ".txt";
  if (mimeType === "text/csv") return ".csv";
  return ".jpg";
};

export const assertInstagramImageUpload = (
  file: Express.Multer.File
): void => {
  const mime = (file.mimetype || "").toLowerCase();
  if (!INSTAGRAM_ALLOWED_IMAGE_MIMES.has(mime)) {
    throw new Error("ERR_INSTAGRAM_MEDIA_TYPE_UNSUPPORTED");
  }
  if (file.size > INSTAGRAM_IMAGE_MAX_BYTES) {
    throw new Error("ERR_INSTAGRAM_IMAGE_TOO_LARGE");
  }
};

export const assertInstagramVideoUpload = (
  file: Express.Multer.File
): void => {
  const mime = (file.mimetype || "").toLowerCase();
  if (!INSTAGRAM_ALLOWED_VIDEO_MIMES.has(mime)) {
    throw new Error("ERR_INSTAGRAM_VIDEO_FORMAT_UNSUPPORTED");
  }
  if (file.size > INSTAGRAM_VIDEO_MAX_BYTES) {
    throw new Error("ERR_INSTAGRAM_VIDEO_TOO_LARGE");
  }
};

export const assertInstagramAudioUpload = (
  file: Express.Multer.File
): void => {
  const mime = (file.mimetype || "").toLowerCase();
  if (!INSTAGRAM_ALLOWED_AUDIO_MIMES.has(mime)) {
    throw new Error("ERR_INSTAGRAM_AUDIO_FORMAT_UNSUPPORTED");
  }
  if (file.size > INSTAGRAM_AUDIO_MAX_BYTES) {
    throw new Error("ERR_INSTAGRAM_AUDIO_TOO_LARGE");
  }
};

export const assertInstagramDocumentUpload = (
  file: Express.Multer.File
): void => {
  const ext = resolveInstagramDocumentExtension(file.originalname);
  if (INSTAGRAM_BLOCKED_DOCUMENT_EXTENSIONS.has(ext)) {
    throw new Error("ERR_INSTAGRAM_DOCUMENT_TYPE_BLOCKED");
  }

  const mime = (file.mimetype || "").toLowerCase();
  const mimeOk = INSTAGRAM_ALLOWED_DOCUMENT_MIMES.has(mime);
  const extOk = INSTAGRAM_ALLOWED_DOCUMENT_EXTENSIONS.has(ext);

  if (!mimeOk && !extOk) {
    throw new Error("ERR_INSTAGRAM_DOCUMENT_FORMAT_UNSUPPORTED");
  }

  if (file.size > INSTAGRAM_DOCUMENT_MAX_BYTES) {
    throw new Error("ERR_INSTAGRAM_DOCUMENT_TOO_LARGE");
  }
};

export const saveInstagramMediaBuffer = ({
  companyId,
  buffer,
  mimeType,
  basename
}: {
  companyId: number;
  buffer: Buffer;
  mimeType: string | null;
  basename: string;
}): { relativePath: string; absolutePath: string; bytes: number } => {
  const dir = getInstagramMediaDirectory(companyId);
  const ext = resolveExtensionFromMime(mimeType);
  const safeBase = basename.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const filename = `${Date.now()}_${safeBase}${ext}`;
  const absolutePath = path.join(dir, filename);
  fs.writeFileSync(absolutePath, buffer);
  const relativePath = path.posix.join("instagram", String(companyId), filename);
  return { relativePath, absolutePath, bytes: buffer.length };
};

export const moveUploadedFileToInstagramFolder = ({
  companyId,
  sourcePath,
  originalName,
  mimeType,
  basename = "media"
}: {
  companyId: number;
  sourcePath: string;
  originalName: string;
  mimeType: string;
  basename?: string;
}): { relativePath: string; absolutePath: string; bytes: number } => {
  const buffer = fs.readFileSync(sourcePath);
  const saved = saveInstagramMediaBuffer({
    companyId,
    buffer,
    mimeType,
    basename: path.parse(originalName).name || basename
  });
  try {
    fs.unlinkSync(sourcePath);
  } catch {
    /* ignore temp cleanup errors */
  }
  return saved;
};
