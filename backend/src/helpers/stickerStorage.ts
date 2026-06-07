import path from "path";
import fs from "fs";
import multer from "multer";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

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

export function isWebpStickerFile(
  file: Pick<Express.Multer.File, "mimetype" | "originalname">
): boolean {
  const mime = String(file.mimetype || "").toLowerCase();
  const name = String(file.originalname || "").toLowerCase();
  return mime === "image/webp" || name.endsWith(".webp");
}

const stickerStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const companyId = Number((req as any).user?.companyId);
    const folder = getStickerCompanyDir(companyId);
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      fs.chmodSync(folder, 0o777);
    }
    cb(null, folder);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname
      .replace(/\//g, "-")
      .replace(/ /g, "_")
      .replace(/[^a-zA-Z0-9._-]/g, "");
    const base = safe.toLowerCase().endsWith(".webp") ? safe : `${safe}.webp`;
    cb(null, `${Date.now()}_${base}`);
  }
});

export const stickerUpload = multer({
  storage: stickerStorage,
  limits: { fileSize: STICKER_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isWebpStickerFile(file)) {
      cb(null, true);
      return;
    }
    cb(new Error("STICKER_WEBP_ONLY"));
  }
});

export function canManageStickerLibrary(profile?: string): boolean {
  const p = String(profile || "").toLowerCase();
  return p === "admin" || p === "supervisor";
}
