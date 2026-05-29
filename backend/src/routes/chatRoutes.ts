import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";
import { internalChatUpload } from "../config/internalChatUpload";
import AppError from "../errors/AppError";

import * as ChatController from "../controllers/ChatController";

const routes = express.Router();

routes.get("/chats", isAuth, requireAnyPlanFeature("attendance.internal_chat"), ChatController.index);

routes.get("/chats/:id", isAuth, requireAnyPlanFeature("attendance.internal_chat"), ChatController.show);

routes.get("/chats/:id/messages", isAuth, requireAnyPlanFeature("attendance.internal_chat"), ChatController.messages);

routes.post("/chats/:id/messages", isAuth, requireAnyPlanFeature("attendance.internal_chat"), ChatController.saveMessage);

routes.post(
  "/chats/:id/messages/media",
  isAuth,
  requireAnyPlanFeature("attendance.internal_chat"),
  (req, res, next) => {
    internalChatUpload.single("file")(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(new AppError("ERR_INTERNAL_CHAT_FILE_TOO_LARGE", 400));
        }
        return next(new AppError("ERR_INTERNAL_CHAT_UPLOAD_FAILED", 400));
      }
      return next(new AppError("ERR_INTERNAL_CHAT_UPLOAD_FAILED", 400));
    });
  },
  ChatController.saveMessageWithMedia
);

routes.post("/chats/:id/read", isAuth, requireAnyPlanFeature("attendance.internal_chat"), ChatController.checkAsRead);

routes.post("/chats", isAuth, requireAnyPlanFeature("attendance.internal_chat"), ChatController.store);

routes.put("/chats/:id", isAuth, requireAnyPlanFeature("attendance.internal_chat"), ChatController.update);

routes.delete("/chats/:id", isAuth, requireAnyPlanFeature("attendance.internal_chat"), ChatController.remove);

export default routes;
