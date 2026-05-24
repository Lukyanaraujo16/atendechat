import express from "express";
import isAuth from "../middleware/isAuth";
import requireCompanyNotDelinquent from "../middleware/requireCompanyNotDelinquent";

import * as WhatsAppController from "../controllers/WhatsAppController";
import * as WhatsappBehaviorSettingsController from "../controllers/WhatsappBehaviorSettingsController";
import requireWhatsappBehaviorManager from "../middleware/requireWhatsappBehaviorManager";

const whatsappRoutes = express.Router();

whatsappRoutes.get(
  "/whatsapps/settings-behavior",
  isAuth,
  requireWhatsappBehaviorManager,
  WhatsappBehaviorSettingsController.index
);

whatsappRoutes.put(
  "/whatsapps/settings-behavior/bulk",
  isAuth,
  requireWhatsappBehaviorManager,
  WhatsappBehaviorSettingsController.bulkUpdate
);

whatsappRoutes.get(
  "/whatsapps/:whatsappId/settings-behavior",
  isAuth,
  WhatsappBehaviorSettingsController.show
);

whatsappRoutes.put(
  "/whatsapps/:whatsappId/settings-behavior",
  isAuth,
  requireWhatsappBehaviorManager,
  WhatsappBehaviorSettingsController.update
);

whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);

whatsappRoutes.post(
  "/whatsapp/",
  isAuth,
  requireCompanyNotDelinquent,
  WhatsAppController.store
);

whatsappRoutes.get("/whatsapp/:whatsappId", isAuth, WhatsAppController.show);

whatsappRoutes.put("/whatsapp/:whatsappId", isAuth, WhatsAppController.update);

whatsappRoutes.put("/whatsapp/:whatsappId/token", isAuth, WhatsAppController.generateToken);

whatsappRoutes.delete(
  "/whatsapp/:whatsappId",
  isAuth,
  WhatsAppController.remove
);

export default whatsappRoutes;
