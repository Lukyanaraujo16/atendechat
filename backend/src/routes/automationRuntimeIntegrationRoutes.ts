import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationRuntimeIntegrationController";

const routes = Router();
const mw = agentOsStacks.runtime()

routes.post("/automation/runtime/execute", ...mw, Ctrl.execute);
routes.get("/automation/runtime/requests", ...mw, Ctrl.requests);
routes.get("/automation/runtime/requests/:id", ...mw, Ctrl.requestById);
routes.get("/automation/runtime/metrics", ...mw, Ctrl.metrics);
routes.get("/automation/runtime/policies", ...mw, Ctrl.policies);

routes.get("/automation/runtime/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/runtime/config", ...mw, Ctrl.getConfig);
routes.put("/automation/runtime/config", ...mw, Ctrl.putConfig);

routes.post("/automation/runtime/preview-request", ...mw, Ctrl.previewRequest);
routes.post("/automation/runtime/inspect-dispatcher", ...mw, Ctrl.inspectDispatcher);
routes.post("/automation/runtime/simulate-policy", ...mw, Ctrl.simulatePolicy);
routes.post("/automation/runtime/replay", ...mw, Ctrl.replay);

export default routes;
