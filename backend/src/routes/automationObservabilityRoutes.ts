import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationObservabilityController";

const routes = Router();
const mw = agentOsStacks.monitor();

routes.get("/automation/observability/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/observability/health", ...mw, Ctrl.health);
routes.get("/automation/observability/metrics", ...mw, Ctrl.metrics);
routes.get("/automation/observability/events", ...mw, Ctrl.events);
routes.get("/automation/observability/alerts", ...mw, Ctrl.alerts);
routes.post(
  "/automation/observability/alerts/:alertId/acknowledge",
  ...mw,
  Ctrl.acknowledgeAlert
);
routes.get("/automation/observability/trace/:traceId", ...mw, Ctrl.trace);
routes.get("/automation/observability/timeline/:traceId", ...mw, Ctrl.timeline);
routes.get("/automation/observability/export", ...mw, Ctrl.exportData);
routes.post("/automation/observability/export", ...mw, Ctrl.exportData);
routes.post("/automation/observability/ops", ...mw, Ctrl.runOps);
routes.get("/automation/observability/config", ...mw, Ctrl.getConfig);
routes.put("/automation/observability/config", ...mw, Ctrl.putConfig);
routes.post("/automation/observability/probe", ...mw, Ctrl.probe);

export default routes;
