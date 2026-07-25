import { Router } from "express";
import isAuth from "../middleware/isAuth";
import { requireAgentOsConsole } from "../middleware/requirePlatformPermission";
import * as TechnicalConsoleController from "../controllers/TechnicalConsoleController";

const technicalConsoleRoutes = Router();

/**
 * Verificação de acesso ao Console Técnico.
 * Gate: identidade interna AND agentOS.console.view.
 */
technicalConsoleRoutes.get(
  "/technical-console/access",
  isAuth,
  requireAgentOsConsole,
  TechnicalConsoleController.access
);

export default technicalConsoleRoutes;
