import { Router, Request, Response, NextFunction } from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import noStoreCache from "../middleware/noStoreCache";
import { stickerUpload } from "../helpers/stickerStorage";
import * as StickerController from "../controllers/StickerController";
import AppError from "../errors/AppError";

const stickerRoutes = Router();

stickerRoutes.use(isAuth);
stickerRoutes.use(requireAnyPlanFeature("attendance.inbox"));

stickerRoutes.get("/stickers", noStoreCache, StickerController.index);
stickerRoutes.post(
  "/stickers",
  (req: Request, res: Response, next: NextFunction) => {
    stickerUpload.single("sticker")(req, res, (err?: unknown) => {
      if (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        if (message === "STICKER_INVALID_FORMAT") {
          next(new AppError("STICKER_INVALID_FORMAT", 400));
          return;
        }
        if (message === "LIMIT_FILE_SIZE") {
          next(new AppError("STICKER_INPUT_TOO_LARGE", 400));
          return;
        }
        next(err instanceof Error ? err : new Error(message));
        return;
      }
      StickerController.store(req, res).catch(next);
    });
  }
);
stickerRoutes.post(
  "/stickers/from-message/:messageId",
  StickerController.createFromMessage
);
stickerRoutes.delete("/stickers/:stickerId", StickerController.remove);
stickerRoutes.post(
  "/messages/:ticketId/sticker",
  StickerController.sendToTicket
);

export default stickerRoutes;
