import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationExecutionFeedbackController";

const routes = Router();
const mw = agentOsStacks.core()

routes.post("/automation/feedback/process", ...mw, Ctrl.process);
routes.get("/automation/feedback", ...mw, Ctrl.list);
routes.get("/automation/feedback/metrics", ...mw, Ctrl.metrics);
routes.get("/automation/feedback/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/feedback/config", ...mw, Ctrl.getConfig);
routes.put("/automation/feedback/config", ...mw, Ctrl.putConfig);
routes.get("/automation/feedback/:id", ...mw, Ctrl.show);
routes.post("/automation/feedback/simulate", ...mw, Ctrl.simulate);
routes.post("/automation/feedback/replay", ...mw, Ctrl.replay);

export default routes;
