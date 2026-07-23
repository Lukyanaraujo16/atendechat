import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationMcpController";

const routes = Router();
const mwMcp = agentOsStacks.mcp()

routes.post("/automation/mcp/servers", ...mwMcp, Ctrl.createServer);
routes.get("/automation/mcp/servers", ...mwMcp, Ctrl.listServers);
routes.get("/automation/mcp/servers/:id", ...mwMcp, Ctrl.getServer);
routes.put("/automation/mcp/servers/:id", ...mwMcp, Ctrl.updateServer);
routes.delete("/automation/mcp/servers/:id", ...mwMcp, Ctrl.deleteServer);

routes.post("/automation/mcp/servers/:id/test", ...mwMcp, Ctrl.testServer);
routes.post("/automation/mcp/servers/:id/health", ...mwMcp, Ctrl.healthServer);
routes.post("/automation/mcp/servers/:id/connect", ...mwMcp, Ctrl.connectServer);
routes.post("/automation/mcp/servers/:id/disconnect", ...mwMcp, Ctrl.disconnectServer);
routes.post("/automation/mcp/servers/:id/sync", ...mwMcp, Ctrl.syncServer);
routes.get("/automation/mcp/servers/:id/tools", ...mwMcp, Ctrl.listServerTools);

routes.get("/automation/mcp/tools", ...mwMcp, Ctrl.listTools);
routes.get("/automation/mcp/tools/:serverId/:toolName", ...mwMcp, Ctrl.getTool);
routes.put("/automation/mcp/tools/:serverId/:toolName", ...mwMcp, Ctrl.updateTool);

routes.post("/automation/mcp/preview", ...mwMcp, Ctrl.preview);
routes.post("/automation/mcp/execute", ...mwMcp, Ctrl.execute);
routes.post("/automation/mcp/confirm", ...mwMcp, Ctrl.confirm);

routes.get("/automation/mcp/executions", ...mwMcp, Ctrl.executions);
routes.get("/automation/mcp/executions/:id", ...mwMcp, Ctrl.executionById);
routes.get("/automation/mcp/metrics", ...mwMcp, Ctrl.metrics);
routes.get("/automation/mcp/dashboard", ...mwMcp, Ctrl.dashboard);
routes.get("/automation/mcp/replay/:id", ...mwMcp, Ctrl.replay);
routes.post("/automation/mcp/replay", ...mwMcp, Ctrl.replay);

routes.get("/automation/mcp/config", ...mwMcp, Ctrl.getConfig);
routes.put("/automation/mcp/config", ...mwMcp, Ctrl.putConfig);

routes.post("/automation/mcp/credentials", ...mwMcp, Ctrl.createCredential);
routes.get("/automation/mcp/credentials", ...mwMcp, Ctrl.listCredentials);

routes.post("/automation/mcp/simulate-policy", ...mwMcp, Ctrl.simulatePolicy);
routes.post("/automation/mcp/simulate-fallback", ...mwMcp, Ctrl.simulateFallback);
routes.post("/automation/mcp/normalize-result", ...mwMcp, Ctrl.normalizeResult);
routes.post("/automation/mcp/inspect-dispatch", ...mwMcp, Ctrl.inspectDispatch);

export default routes;
