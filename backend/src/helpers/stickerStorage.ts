import path from "path";
import fs from "fs";
import multer from "multer";
import {
  STICKER_RASTER_INPUT_MAX_BYTES,
  isAllowedStickerUploadFile
} from "./stickerImageProcessing";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

/** @deprecated use STICKER_OUTPUT_MAX_BYTES from stickerImageProcessing */
export const STICKER_MAX_BYTES = 512 * 1024;

export function getStickerCompanyDir(companyId: number): string {
  return path.resolve(publicFolder, "stickers", `company-${companyId}`);
}

export function buildStickerRelativePath(companyId: number, fileName: string): string {
  return `stickers/company-${companyId}/${fileName}`;
}

export function resolveStickerAbsolutePath(relativePath: string): string {
  return path.resolve(publicFolder, relativePath);
}

export function ensureStickerCompanyDir(companyId: number): string {
  const folder = getStickerCompanyDir(companyId);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
    fs.chmodSync(folder, 0o777);
  }
  return folder;
}

export function isWebpStickerFile(
  file: Pick<Express.Multer.File, "mimetype" | "originalname">
): boolean {
  const mime = String(file.mimetype || "").toLowerCase();
  const name = String(file.originalname || "").toLowerCase();
  return mime === "image/webp" || name.endsWith(".webp");
}

export const stickerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: STICKER_RASTER_INPUT_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedStickerUploadFile(file)) {
      cb(null, true);
      return;
    }
    cb(new Error("STICKER_INVALID_FORMAT"));
  }
});

export function canManageStickerLibrary(profile?: string): boolean {
  const p = String(profile || "").toLowerCase();
  return p === "admin" || p === "supervisor";
}
