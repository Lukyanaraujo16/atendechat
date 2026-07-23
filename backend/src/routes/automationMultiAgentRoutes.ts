import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationMultiAgentController";

const routes = Router();
const mw = agentOsStacks.multiAgent()

// Static paths before /:id
routes.get("/automation/agents/config", ...mw, Ctrl.getConfig);
routes.put("/automation/agents/config", ...mw, Ctrl.putConfig);
routes.get("/automation/agents/metrics", ...mw, Ctrl.metrics);
routes.get("/automation/agents/dashboard", ...mw, Ctrl.dashboard);
routes.get("/automation/agents/audit", ...mw, Ctrl.audit);
routes.get("/automation/agents/sessions", ...mw, Ctrl.listSessions);
routes.get("/automation/agents/sessions/:id", ...mw, Ctrl.getSession);
routes.get("/automation/agents/replay/:id", ...mw, Ctrl.replay);

routes.post("/automation/agents/routing/simulate", ...mw, Ctrl.simulateRouting);
routes.post("/automation/agents/routing/select", ...mw, Ctrl.selectRouting);
routes.get("/automation/agents/routing/decisions", ...mw, Ctrl.listRoutingDecisions);
routes.get("/automation/agents/routing/decisions/:id", ...mw, Ctrl.getRoutingDecision);

routes.post("/automation/agents/sticky", ...mw, Ctrl.upsertSticky);
routes.get("/automation/agents/sticky", ...mw, Ctrl.listSticky);
routes.delete("/automation/agents/sticky/:id", ...mw, Ctrl.deleteSticky);

routes.post("/automation/agents/delegations/preview", ...mw, Ctrl.previewDelegation);
routes.post("/automation/agents/delegations/simulate", ...mw, Ctrl.simulateDelegation);
routes.post("/automation/agents/delegations/approve", ...mw, Ctrl.approveDelegation);
routes.get("/automation/agents/delegations", ...mw, Ctrl.listDelegations);
routes.get("/automation/agents/delegations/:id", ...mw, Ctrl.getDelegation);

routes.post("/automation/agents/handoffs/preview", ...mw, Ctrl.previewHandoff);
routes.post("/automation/agents/handoffs/simulate", ...mw, Ctrl.simulateHandoff);
routes.post("/automation/agents/handoffs/approve", ...mw, Ctrl.approveHandoff);
routes.get("/automation/agents/handoffs", ...mw, Ctrl.listHandoffs);
routes.get("/automation/agents/handoffs/:id", ...mw, Ctrl.getHandoff);

routes.post("/automation/agents/coordination/plan", ...mw, Ctrl.createCoordination);
routes.post("/automation/agents/coordination/simulate", ...mw, Ctrl.simulateCoordination);
routes.get("/automation/agents/coordination", ...mw, Ctrl.listCoordination);
routes.get("/automation/agents/coordination/:id", ...mw, Ctrl.getCoordination);

routes.post("/automation/agents/messages", ...mw, Ctrl.sendMessage);
routes.get("/automation/agents/messages", ...mw, Ctrl.listMessages);
routes.get("/automation/agents/messages/:id", ...mw, Ctrl.getMessage);

routes.post("/automation/agents/interventions", ...mw, Ctrl.createIntervention);
routes.get("/automation/agents/interventions", ...mw, Ctrl.listInterventions);
routes.get("/automation/agents/interventions/:id", ...mw, Ctrl.getIntervention);
routes.post("/automation/agents/interventions/:id/resolve", ...mw, Ctrl.resolveIntervention);

routes.post("/automation/agents/simulate/full-flow", ...mw, Ctrl.simulateFullFlow);
routes.post("/automation/agents/simulate/memory", ...mw, Ctrl.simulateMemory);
routes.post("/automation/agents/simulate/fallback", ...mw, Ctrl.simulateFallback);
routes.post("/automation/agents/simulate/isolate-failure", ...mw, Ctrl.isolateFailure);

routes.post("/automation/agents", ...mw, Ctrl.createAgent);
routes.get("/automation/agents", ...mw, Ctrl.listAgents);
routes.get("/automation/agents/:id", ...mw, Ctrl.getAgent);
routes.put("/automation/agents/:id", ...mw, Ctrl.updateAgent);
routes.delete("/automation/agents/:id", ...mw, Ctrl.deleteAgent);
routes.post("/automation/agents/:id/activate", ...mw, Ctrl.activateAgent);
routes.post("/automation/agents/:id/deactivate", ...mw, Ctrl.deactivateAgent);
routes.post("/automation/agents/:id/suspend", ...mw, Ctrl.suspendAgent);
routes.post("/automation/agents/:id/archive", ...mw, Ctrl.archiveAgent);
routes.post("/automation/agents/:id/duplicate", ...mw, Ctrl.duplicateAgent);
routes.get("/automation/agents/:id/versions", ...mw, Ctrl.listVersions);
routes.get("/automation/agents/:id/versions/:version", ...mw, Ctrl.getVersion);
routes.post("/automation/agents/:id/health", ...mw, Ctrl.healthAgent);
routes.get("/automation/agents/:id/health", ...mw, Ctrl.healthAgent);

export default routes;
