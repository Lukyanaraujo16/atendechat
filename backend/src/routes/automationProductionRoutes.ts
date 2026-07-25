import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import {
  requireAgentOsManage,
  requireAgentOsRolloutManage,
  requireAgentOsProductionManage,
  requireAgentOsIncidentsManage
} from "../middleware/requirePlatformPermission";
import { logAgentOsTechnicalWrite } from "../middleware/logAgentOsTechnicalWrite";
import * as Ctrl from "../controllers/AutomationProductionController";

const routes = Router();
const mw = agentOsStacks.monitor();
const audit = (action: string) => logAgentOsTechnicalWrite(action);

/**
 * Production / rollout / incidents — technical_read = console.view (stack);
 * mutações exigem chaves específicas de plataforma (Fase 1.4).
 * RBAC antigo (admin tenant) removido.
 */
routes.get("/automation/production", ...mw, Ctrl.productionDashboard);
routes.get(
  "/automation/production-readiness",
  ...mw,
  Ctrl.productionReadiness
);
routes.get("/automation/rollout", ...mw, Ctrl.getRollout);
routes.get("/automation/rollout/history", ...mw, Ctrl.rolloutHistory);
routes.post(
  "/automation/rollout/preflight",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  Ctrl.preflight
);
routes.post(
  "/automation/rollout/transition",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  Ctrl.transition
);
routes.post(
  "/automation/rollout/suspend",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  Ctrl.suspend
);
routes.post(
  "/automation/rollout/resume",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  Ctrl.resume
);
routes.post(
  "/automation/rollout/rollback",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  Ctrl.rollback
);
routes.get("/automation/kill-switches", ...mw, Ctrl.listKill);
routes.post(
  "/automation/kill-switches",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  Ctrl.setKill
);
routes.get("/automation/kill-switches/resolved", ...mw, Ctrl.resolveKill);
routes.post(
  "/automation/emergency-stop",
  ...mw,
  requireAgentOsProductionManage,
  audit("agentOS.production.manage"),
  Ctrl.emergencyStop
);
routes.get("/automation/incidents", ...mw, Ctrl.listIncidents);
routes.get("/automation/incidents/:id", ...mw, Ctrl.getIncident);
routes.post(
  "/automation/incidents/:id/acknowledge",
  ...mw,
  requireAgentOsIncidentsManage,
  audit("agentOS.incidents.manage"),
  Ctrl.ackIncident
);
routes.post(
  "/automation/incidents/:id/resolve",
  ...mw,
  requireAgentOsIncidentsManage,
  audit("agentOS.incidents.manage"),
  Ctrl.resolveIncident
);
routes.get("/automation/release-readiness", ...mw, Ctrl.releaseReadiness);
routes.post(
  "/automation/release-readiness/check",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.checkReleaseReadiness
);
routes.get(
  "/automation/environment-validation",
  ...mw,
  Ctrl.environmentValidation
);
routes.get("/automation/evidence-package", ...mw, Ctrl.evidencePackage);
routes.post(
  "/automation/hydrate",
  ...mw,
  requireAgentOsProductionManage,
  audit("agentOS.production.manage"),
  Ctrl.hydrate
);

export default routes;
