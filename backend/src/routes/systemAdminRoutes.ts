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

systemAdminRoutes.post(
  "/system/update/:action",
  isAuth,
  isSuper,
  SystemUpdateController.runAction
);

export default systemAdminRoutes;
