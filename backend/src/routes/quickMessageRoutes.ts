import express from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";

import * as QuickMessageController from "../controllers/QuickMessageController";
import multer from "multer";
import uploadConfig from "../config/upload";

const upload = multer(uploadConfig);

const routes = express.Router();

routes.get(
  "/quick-messages/list",
  isAuth,
  requireAnyPlanFeature("automation.quick_replies"),
  QuickMessageController.findList
);

routes.get(
  "/quick-messages",
  isAuth,
  requireAnyPlanFeature("automation.quick_replies"),
  QuickMessageController.index
);

routes.get(
  "/quick-messages/:id",
  isAuth,
  requireAnyPlanFeature("automation.quick_replies"),
  QuickMessageController.show
);

routes.post(
  "/quick-messages",
  isAuth,
  requireAnyPlanFeature("automation.quick_replies"),
  QuickMessageController.store
);

routes.put(
  "/quick-messages/:id",
  isAuth,
  requireAnyPlanFeature("automation.quick_replies"),
  QuickMessageController.update
);

routes.delete(
  "/quick-messages/:id",
  isAuth,
  requireAnyPlanFeature("automation.quick_replies"),
  QuickMessageController.remove
);

routes.post(
  "/quick-messages/:id/media-upload",
  isAuth,
  requireAnyPlanFeature("automation.quick_replies"),
  upload.array("file"),
  QuickMessageController.mediaUpload
);

routes.delete(
  "/quick-messages/:id/media-upload",
  isAuth,
  requireAnyPlanFeature("automation.quick_replies"),
  QuickMessageController.deleteMedia
);
  
export default routes;
