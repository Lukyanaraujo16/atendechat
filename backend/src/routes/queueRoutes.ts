import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireAnyPlanFeature from "../middleware/requirePlanFeature";

import * as QueueController from "../controllers/QueueController";

const queueRoutes = Router();

queueRoutes.get("/queue", isAuth, QueueController.index);

queueRoutes.post(
  "/queue",
  isAuth,
  requireAnyPlanFeature("team.queues"),
  QueueController.store
);

queueRoutes.get("/queue/:queueId/users", isAuth, QueueController.listUsers);
queueRoutes.get("/queue/:queueId", isAuth, QueueController.show);

queueRoutes.put(
  "/queue/:queueId",
  isAuth,
  requireAnyPlanFeature("team.queues"),
  QueueController.update
);

queueRoutes.delete(
  "/queue/:queueId",
  isAuth,
  requireAnyPlanFeature("team.queues"),
  QueueController.remove
);

export default queueRoutes;
