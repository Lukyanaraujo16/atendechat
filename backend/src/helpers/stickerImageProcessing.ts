import sharp from "sharp";
import AppError from "../errors/AppError";

export const STICKER_OUTPUT_MAX_BYTES = 512 * 1024;
export const STICKER_RASTER_INPUT_MAX_BYTES = 2 * 1024 * 1024;
export const STICKER_WEBP_INPUT_MAX_BYTES = 512 * 1024;

const ALLOWED_MIMES = new Set(["image/webp", "image/png", "image/jpeg"]);
const ALLOWED_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];
const WEBP_QUALITIES = [85, 75, 65];

export function isAllowedStickerMime(mime: string): boolean {
  return ALLOWED_MIMES.has(String(mime || "").toLowerCase());
}

export function hasAllowedStickerExtension(fileName: string): boolean {
  const name = String(fileName || "").toLowerCase();
  return ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
}

export function isAllowedStickerUploadFile(
  file: Pick<Express.Multer.File, "mimetype" | "originalname">
): boolean {
  return (
    isAllowedStickerMime(file.mimetype) &&
    hasAllowedStickerExtension(file.originalname)
  );
}

export function sanitizeStickerBaseName(originalname: string): string {
  const safe = String(originalname || "sticker")
    .replace(/\//g, "-")
    .replace(/ /g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
  const base = safe.replace(/\.(webp|png|jpe?g)$/i, "");
  return base || "sticker";
}

export function buildStickerFileName(originalname: string): string {
  return `${Date.now()}_${sanitizeStickerBaseName(originalname)}.webp`;
}

async function encodeStickerWebp(
  buffer: Buffer,
  quality: number
): Promise<Buffer> {
  return sharp(buffer)
    .rotate()
    .resize(512, 512, {
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality, effort: 4 })
    .toBuffer();
}

async function canPassThroughWebp(buffer: Buffer): Promise<boolean> {
  if (buffer.length > STICKER_OUTPUT_MAX_BYTES) {
    return false;
  }

  try {
    const meta = await sharp(buffer).metadata();
    const width = meta.width || 0;
    const height = meta.height || 0;
    return width > 0 && height > 0 && width <= 512 && height <= 512;
  } catch {
    return false;
  }
}

export async function processStickerToWebp(
  buffer: Buffer,
  mimeType: string
): Promise<Buffer> {
  const mime = String(mimeType || "").toLowerCase();

  if (!buffer?.length) {
    throw new AppError("STICKER_CONVERSION_FAILED", 400);
  }

  if (mime === "image/webp" && (await canPassThroughWebp(buffer))) {
    return buffer;
  }

  for (const quality of WEBP_QUALITIES) {
    try {
      const output = await encodeStickerWebp(buffer, quality);
      if (output.length <= STICKER_OUTPUT_MAX_BYTES) {
        return output;
      }
    } catch {
      throw new AppError("STICKER_CONVERSION_FAILED", 400);
    }
  }

  throw new AppError("STICKER_TOO_LARGE", 400);
}
