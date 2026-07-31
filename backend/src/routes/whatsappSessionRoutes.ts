import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";

import WhatsAppSessionController from "../controllers/WhatsAppSessionController";

const whatsappSessionRoutes = Router();

const requireConnectionsManage = requireEffectiveModule("settings.connections");

whatsappSessionRoutes.post(
  "/whatsappsession/:whatsappId",
  isAuth,
  requireConnectionsManage,
  WhatsAppSessionController.store
);

whatsappSessionRoutes.put(
  "/whatsappsession/:whatsappId",
  isAuth,
  requireConnectionsManage,
  WhatsAppSessionController.update
);

whatsappSessionRoutes.delete(
  "/whatsappsession/:whatsappId",
  isAuth,
  requireConnectionsManage,
  WhatsAppSessionController.remove
);

export default whatsappSessionRoutes;
