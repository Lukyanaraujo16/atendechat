import fs from "fs";
import AppError from "../../errors/AppError";
import Sticker from "../../models/Sticker";
import { resolveStickerAbsolutePath } from "../../helpers/stickerStorage";
import {
  decrementCompanyStorageUsage,
  tryStatFileBytes
} from "../CompanyService/adjustCompanyStorageUsage";

interface Request {
  id: number;
  companyId: number;
}

const DeleteStickerService = async ({
  id,
  companyId
}: Request): Promise<void> => {
  const sticker = await Sticker.findOne({
    where: { id, companyId }
  });

  if (!sticker) {
    throw new AppError("ERR_NO_STICKER_FOUND", 404);
  }

  const abs = resolveStickerAbsolutePath(sticker.filePath);
  const bytes = tryStatFileBytes(abs);
  if (fs.existsSync(abs)) {
    fs.unlinkSync(abs);
  }

  await sticker.destroy();

  if (bytes > 0) {
    void decrementCompanyStorageUsage(companyId, bytes);
  }
};

export default DeleteStickerService;
