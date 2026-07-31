import express from "express";
import isAuth from "../middleware/isAuth";
import requireCompanyNotDelinquent from "../middleware/requireCompanyNotDelinquent";
import requireEffectiveModule from "../middleware/requireEffectiveModule";

import * as WhatsAppController from "../controllers/WhatsAppController";
import * as WhatsappBehaviorSettingsController from "../controllers/WhatsappBehaviorSettingsController";
import requireWhatsappBehaviorManager from "../middleware/requireWhatsappBehaviorManager";

const whatsappRoutes = express.Router();

/** Gerenciamento de conexões/sessões — chave settings.connections */
const requireConnectionsManage = requireEffectiveModule("settings.connections");

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

/** Listagem usada em atendimento/transferência — não exige settings.connections */
whatsappRoutes.get("/whatsapp/", isAuth, WhatsAppController.index);

whatsappRoutes.post(
  "/whatsapp/",
  isAuth,
  requireCompanyNotDelinquent,
  requireConnectionsManage,
  WhatsAppController.store
);

whatsappRoutes.get(
  "/whatsapp/:whatsappId",
  isAuth,
  requireConnectionsManage,
  WhatsAppController.show
);

whatsappRoutes.put(
  "/whatsapp/:whatsappId",
  isAuth,
  requireConnectionsManage,
  WhatsAppController.update
);

whatsappRoutes.put(
  "/whatsapp/:whatsappId/token",
  isAuth,
  requireConnectionsManage,
  WhatsAppController.generateToken
);

whatsappRoutes.delete(
  "/whatsapp/:whatsappId",
  isAuth,
  requireConnectionsManage,
  WhatsAppController.remove
);

export default whatsappRoutes;
