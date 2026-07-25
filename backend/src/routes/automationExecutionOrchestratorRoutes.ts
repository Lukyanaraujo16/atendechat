import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import {
  requireAgentOsManage,
  requireAgentOsReplayExecute
} from "../middleware/requirePlatformPermission";
import { logAgentOsTechnicalWrite } from "../middleware/logAgentOsTechnicalWrite";
import * as Ctrl from "../controllers/AutomationExecutionOrchestratorController";

const routes = Router();
const mw = agentOsStacks.runtime();
const audit = (a: string) => logAgentOsTechnicalWrite(a);

routes.get("/automation/execution/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/execution/config", ...mw, Ctrl.getConfig);
routes.put(
  "/automation/execution/config",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.putConfig
);
routes.get("/automation/execution/metrics", ...mw, Ctrl.metrics);

routes.post(
  "/automation/execution/session",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.createSession
);
routes.post(
  "/automation/execution/start",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.startSession
);
routes.post(
  "/automation/execution/pause",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.pauseSession
);
routes.post(
  "/automation/execution/resume",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.resumeSession
);
routes.post(
  "/automation/execution/abort",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.abortSession
);
routes.post(
  "/automation/execution/advance",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.advanceSession
);

routes.get("/automation/execution/sessions", ...mw, Ctrl.listSessions);
routes.get("/automation/execution/sessions/:id", ...mw, Ctrl.showSession);
routes.get(
  "/automation/execution/replay/:id",
  ...mw,
  requireAgentOsReplayExecute,
  audit("agentOS.replay.execute"),
  Ctrl.replayById
);
routes.post(
  "/automation/execution/replay",
  ...mw,
  requireAgentOsReplayExecute,
  audit("agentOS.replay.execute"),
  Ctrl.replay
);

routes.post(
  "/automation/execution/simulate/transition",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.simulateTransition
);
routes.post(
  "/automation/execution/graph",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.inspectGraph
);
routes.post(
  "/automation/execution/simulate/recovery",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.simulateRecovery
);
routes.post(
  "/automation/execution/next-steps",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  Ctrl.nextSteps
);

export default routes;
