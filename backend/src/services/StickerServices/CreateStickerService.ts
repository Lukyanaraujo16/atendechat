import AppError from "../../errors/AppError";
import Sticker from "../../models/Sticker";
import {
  buildStickerRelativePath,
  isWebpStickerFile
} from "../../helpers/stickerStorage";
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
  if (!file || !isWebpStickerFile(file)) {
    throw new AppError("STICKER_WEBP_ONLY", 400);
  }

  const filePath = buildStickerRelativePath(companyId, file.filename);
  const displayName =
    (name && String(name).trim()) ||
    file.originalname.replace(/\.webp$/i, "") ||
    file.filename;

  const sticker = await Sticker.create({
    companyId,
    name: displayName,
    fileName: file.filename,
    filePath,
    mimeType: file.mimetype || "image/webp",
    size: file.size || 0,
    createdBy: userId,
    isActive: true,
    sortOrder: 0
  });

  if (file.size > 0) {
    void incrementCompanyStorageUsage(companyId, file.size);
  }

  return sticker;
};

export default CreateStickerService;
