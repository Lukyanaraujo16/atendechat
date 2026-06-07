import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import Sticker from "../../models/Sticker";
import {
  buildStickerRelativePath,
  ensureStickerCompanyDir
} from "../../helpers/stickerStorage";
import {
  buildStickerFileName,
  isAllowedStickerUploadFile,
  processStickerToWebp,
  sanitizeStickerBaseName,
  STICKER_RASTER_INPUT_MAX_BYTES,
  STICKER_WEBP_INPUT_MAX_BYTES
} from "../../helpers/stickerImageProcessing";
import { incrementCompanyStorageUsage } from "../CompanyService/adjustCompanyStorageUsage";

interface Request {
  companyId: number;
  userId: number;
  file: Express.Multer.File;
  name?: string;
}

const CreateStickerService = async ({
  companyId,
  userId,
  file,
  name
}: Request): Promise<Sticker> => {
  if (!file?.buffer?.length) {
    throw new AppError("ERR_STICKER_FILE_REQUIRED", 400);
  }

  if (!isAllowedStickerUploadFile(file)) {
    throw new AppError("STICKER_INVALID_FORMAT", 400);
  }

  const mime = String(file.mimetype || "").toLowerCase();
  const inputSize = file.buffer.length;

  if (mime === "image/webp" && inputSize > STICKER_WEBP_INPUT_MAX_BYTES) {
    throw new AppError("STICKER_TOO_LARGE", 400);
  }

  if (
    (mime === "image/png" || mime === "image/jpeg") &&
    inputSize > STICKER_RASTER_INPUT_MAX_BYTES
  ) {
    throw new AppError("STICKER_TOO_LARGE", 400);
  }

  let webpBuffer: Buffer;
  try {
    webpBuffer = await processStickerToWebp(file.buffer, mime);
  } catch (err: any) {
    if (
      err?.message === "STICKER_TOO_LARGE" ||
      err?.message === "STICKER_CONVERSION_FAILED"
    ) {
      throw err;
    }
    throw new AppError("STICKER_CONVERSION_FAILED", 400);
  }

  const fileName = buildStickerFileName(file.originalname);
  const folder = ensureStickerCompanyDir(companyId);
  const absolutePath = path.join(folder, fileName);
  fs.writeFileSync(absolutePath, webpBuffer);

  const filePath = buildStickerRelativePath(companyId, fileName);
  const displayName =
    (name && String(name).trim()) ||
    sanitizeStickerBaseName(file.originalname) ||
    fileName;

  const sticker = await Sticker.create({
    companyId,
    name: displayName,
    fileName,
    filePath,
    mimeType: "image/webp",
    size: webpBuffer.length,
    createdBy: userId,
    isActive: true,
    sortOrder: 0
  });

  if (webpBuffer.length > 0) {
    void incrementCompanyStorageUsage(companyId, webpBuffer.length);
  }

  return sticker;
};

export default CreateStickerService;
