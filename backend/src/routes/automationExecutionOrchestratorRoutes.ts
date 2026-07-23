import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationExecutionOrchestratorController";

const routes = Router();
const mw = agentOsStacks.runtime()

routes.get("/automation/execution/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/execution/config", ...mw, Ctrl.getConfig);
routes.put("/automation/execution/config", ...mw, Ctrl.putConfig);
routes.get("/automation/execution/metrics", ...mw, Ctrl.metrics);

routes.post("/automation/execution/session", ...mw, Ctrl.createSession);
routes.post("/automation/execution/start", ...mw, Ctrl.startSession);
routes.post("/automation/execution/pause", ...mw, Ctrl.pauseSession);
routes.post("/automation/execution/resume", ...mw, Ctrl.resumeSession);
routes.post("/automation/execution/abort", ...mw, Ctrl.abortSession);
routes.post("/automation/execution/advance", ...mw, Ctrl.advanceSession);

routes.get("/automation/execution/sessions", ...mw, Ctrl.listSessions);
routes.get("/automation/execution/sessions/:id", ...mw, Ctrl.showSession);
routes.get("/automation/execution/replay/:id", ...mw, Ctrl.replayById);
routes.post("/automation/execution/replay", ...mw, Ctrl.replay);

routes.post("/automation/execution/simulate/transition", ...mw, Ctrl.simulateTransition);
routes.post("/automation/execution/graph", ...mw, Ctrl.inspectGraph);
routes.post("/automation/execution/simulate/recovery", ...mw, Ctrl.simulateRecovery);
routes.post("/automation/execution/next-steps", ...mw, Ctrl.nextSteps);

export default routes;
