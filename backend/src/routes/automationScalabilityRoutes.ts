import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationScalabilityController";

const routes = Router();
const mw = agentOsStacks.monitor();

routes.get("/automation/scalability/health", ...mw, Ctrl.health);
routes.get("/automation/scalability/queue-health", ...mw, Ctrl.queueHealth);
routes.get("/automation/scalability/workers", ...mw, Ctrl.workers);
routes.get("/automation/scalability/jobs", ...mw, Ctrl.jobs);
routes.post("/automation/scalability/jobs", ...mw, Ctrl.enqueue);
routes.post(
  "/automation/scalability/jobs/:jobId/reprocess",
  ...mw,
  Ctrl.reprocessDlq
);
routes.post("/automation/scalability/cleanup", ...mw, Ctrl.cleanup);
routes.post("/automation/scalability/consistency", ...mw, Ctrl.consistency);
routes.post("/automation/scalability/cache/invalidate", ...mw, Ctrl.invalidateCache);
routes.get("/automation/scalability/config", ...mw, Ctrl.getConfig);
routes.put("/automation/scalability/config", ...mw, Ctrl.putConfig);
routes.get("/automation/scalability/metrics", ...mw, Ctrl.metrics);

export default routes;
