import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationActionExecutionController";

const routes = Router();
const mw = agentOsStacks.core()

routes.post("/automation/actions/execute", ...mw, Ctrl.execute);
routes.get("/automation/actions/strategies", ...mw, Ctrl.strategies);
routes.get("/automation/actions/results", ...mw, Ctrl.results);
routes.get("/automation/actions/results/:id", ...mw, Ctrl.resultById);

routes.get("/automation/actions/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/actions/metrics", ...mw, Ctrl.metrics);
routes.get("/automation/actions/config", ...mw, Ctrl.getConfig);
routes.put("/automation/actions/config", ...mw, Ctrl.putConfig);

routes.post("/automation/actions/replay", ...mw, Ctrl.replay);
routes.post("/automation/actions/simulate", ...mw, Ctrl.simulate);
routes.post("/automation/actions/inspect-strategy", ...mw, Ctrl.inspectStrategy);

export default routes;
