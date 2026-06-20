import path from "path";
import fs from "fs";
import { lookup } from "mime-types";

export const INSTAGRAM_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export const INSTAGRAM_ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp"
]);

const publicFolder = path.resolve(__dirname, "..", "..", "public");

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
  mimeType
}: {
  companyId: number;
  sourcePath: string;
  originalName: string;
  mimeType: string;
}): { relativePath: string; absolutePath: string; bytes: number } => {
  const buffer = fs.readFileSync(sourcePath);
  const saved = saveInstagramMediaBuffer({
    companyId,
    buffer,
    mimeType,
    basename: path.parse(originalName).name || "image"
  });
  try {
    fs.unlinkSync(sourcePath);
  } catch {
    /* ignore temp cleanup errors */
  }
  return saved;
};
