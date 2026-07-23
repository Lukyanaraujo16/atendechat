import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationCognitiveMemoryController";

const routes = Router();
const mw = agentOsStacks.memory()

routes.post("/automation/memory", ...mw, Ctrl.create);
routes.get("/automation/memory", ...mw, Ctrl.list);
routes.get("/automation/memory/metrics", ...mw, Ctrl.metrics);
routes.get("/automation/memory/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/memory/config", ...mw, Ctrl.getConfig);
routes.put("/automation/memory/config", ...mw, Ctrl.putConfig);
routes.post("/automation/memory/query", ...mw, Ctrl.query);
routes.post("/automation/memory/build-knowledge", ...mw, Ctrl.buildKnowledge);
routes.post("/automation/memory/replay", ...mw, Ctrl.replay);
routes.get("/automation/memory/:id", ...mw, Ctrl.show);

export default routes;
