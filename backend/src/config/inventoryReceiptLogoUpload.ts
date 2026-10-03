import multer from "multer";

import AppError from "../errors/AppError";
import { RECEIPT_LOGO_MAX_BYTES } from "../services/InventoryService/inventoryReceiptLogo";

export const inventoryReceiptLogoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: RECEIPT_LOGO_MAX_BYTES },
  fileFilter(_req, file, cb) {
    const mimeOk =
      /^(image\/png|image\/jpeg|image\/jpg|image\/pjpeg|image\/webp)$/i.test(
        file.mimetype
      );
    const nameOk = /\.(png|jpe?g|webp)$/i.test(file.originalname || "");
    if (mimeOk && nameOk) {
      cb(null, true);
      return;
    }
    cb(
      new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Use uma imagem PNG, JPG ou WEBP."
      ) as unknown as Error
    );
  }
});
