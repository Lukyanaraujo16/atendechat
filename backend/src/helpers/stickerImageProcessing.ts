import sharp from "sharp";
import AppError from "../errors/AppError";

export const STICKER_OUTPUT_MAX_BYTES = 512 * 1024;
export const STICKER_RASTER_INPUT_MAX_BYTES = 2 * 1024 * 1024;
export const STICKER_WEBP_INPUT_MAX_BYTES = 512 * 1024;

const ALLOWED_MIMES = new Set(["image/webp", "image/png", "image/jpeg"]);
const ALLOWED_EXTENSIONS = [".webp", ".png", ".jpg", ".jpeg"];
const WEBP_QUALITIES = [85, 75, 65];
const WEBP_ANIM_CHUNK = Buffer.from("ANIM");
const WEBP_ANMF_CHUNK = Buffer.from("ANMF");

/** RIFF WEBP com chunk ANIM/ANMF — mesmo critério estrutural da Evolution 2.3.7. */
export function isAnimatedWebpBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 12) return false;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return false;
  if (buffer.toString("ascii", 8, 12) !== "WEBP") return false;
  return buffer.includes(WEBP_ANIM_CHUNK) || buffer.includes(WEBP_ANMF_CHUNK);
}

export async function countWebpPages(buffer: Buffer): Promise<number> {
  try {
    const meta = await sharp(buffer, { animated: true, pages: -1 }).metadata();
    const pages = Number(meta.pages);
    if (Number.isFinite(pages) && pages > 0) return pages;
  } catch {
    /* fallback estrutural */
  }
  return isAnimatedWebpBuffer(buffer) ? 2 : 1;
}

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
  quality: number,
  animated: boolean
): Promise<Buffer> {
  const pipeline = animated
    ? sharp(buffer, { animated: true, pages: -1 })
    : sharp(buffer).rotate();

  return pipeline
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

  const animated = mime === "image/webp" && isAnimatedWebpBuffer(buffer);

  const tryQuality = async (index: number): Promise<Buffer> => {
    if (index >= WEBP_QUALITIES.length) {
      throw new AppError("STICKER_TOO_LARGE", 400);
    }
    try {
      const output = await encodeStickerWebp(
        buffer,
        WEBP_QUALITIES[index],
        animated
      );
      if (output.length <= STICKER_OUTPUT_MAX_BYTES) {
        return output;
      }
    } catch {
      throw new AppError("STICKER_CONVERSION_FAILED", 400);
    }
    return tryQuality(index + 1);
  };

  return tryQuality(0);
}
