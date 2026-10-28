import { Router } from "express";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import * as SystemMonitorController from "../controllers/SystemMonitorController";
import * as SystemUpdateController from "../controllers/SystemUpdateController";

const systemAdminRoutes = Router();

systemAdminRoutes.get(
  "/system/monitor",
  isAuth,
  isSuper,
  SystemMonitorController.show
);

systemAdminRoutes.get(
  "/system/evolution-monitor",
  isAuth,
  isSuper,
  SystemMonitorController.evolution
);

systemAdminRoutes.get(
  "/system/evolution-monitor/history",
  isAuth,
  isSuper,
  SystemMonitorController.evolutionHistory
);

// Coletor da VPS Evolution: autenticação própria por token (sem sessão de usuário).
systemAdminRoutes.post(
  "/system/evolution-metrics",
  SystemMonitorController.evolutionMetricsIngest
);

systemAdminRoutes.get(
  "/system/update/current",
  isAuth,
  isSuper,
  SystemUpdateController.getCurrent
);

systemAdminRoutes.post(
  "/system/update/:action",
  isAuth,
  isSuper,
  SystemUpdateController.runAction
);

export default systemAdminRoutes;
