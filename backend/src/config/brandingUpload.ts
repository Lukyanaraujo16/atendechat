import path from "path";
import multer from "multer";
import fs from "fs";
import crypto from "crypto";

import AppError from "../errors/AppError";
import uploadConfig from "./upload";

const brandingDir = path.join(uploadConfig.directory, "branding");

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    if (!fs.existsSync(brandingDir)) {
      fs.mkdirSync(brandingDir, { recursive: true });
      try {
        fs.chmodSync(brandingDir, 0o755);
      } catch {
        /* ignore */
      }
    }
    cb(null, brandingDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname) || ".png";
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 48);
    const id = crypto.randomBytes(8).toString("hex");
    cb(null, `branding_${id}${base ? `_${base}` : ""}${ext}`);
  }
});

const imageMime =
  /^image\/(jpeg|pjpeg|png|gif|webp|svg\+xml)$/i;

export const brandingUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (
      imageMime.test(file.mimetype) ||
      /\.(jpe?g|png|gif|webp|svg)$/i.test(file.originalname)
    ) {
      return cb(null, true);
    }
    return cb(
      new AppError(
        "INVALID_BRANDING_IMAGE_TYPE",
        400,
        "Use PNG, JPG, WebP, GIF ou SVG (máx. 2 MB)."
      ) as unknown as Error
    );
  }
});
