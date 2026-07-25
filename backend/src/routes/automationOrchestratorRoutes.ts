import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import {
  requireAgentOsManage,
  requireAgentOsReplayExecute
} from "../middleware/requirePlatformPermission";
import { logAgentOsTechnicalWrite } from "../middleware/logAgentOsTechnicalWrite";
import * as AutomationOrchestratorController from "../controllers/AutomationOrchestratorController";

const automationOrchestratorRoutes = Router();
const mw = agentOsStacks.dashboard();
const mwReplay = agentOsStacks.replay();
const mwTester = agentOsStacks.tester();
const audit = (a: string) => logAgentOsTechnicalWrite(a);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/dashboard",
  ...mw,
  AutomationOrchestratorController.dashboard
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/executions",
  ...mw,
  AutomationOrchestratorController.listExecutions
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/executions/:id",
  ...mw,
  AutomationOrchestratorController.showExecution
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/executions/:id/replay",
  ...mwReplay,
  requireAgentOsReplayExecute,
  audit("agentOS.replay.execute"),
  AutomationOrchestratorController.replayExecution
);

automationOrchestratorRoutes.post(
  "/automation/orchestrator/executions/:id/continue",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  AutomationOrchestratorController.continueExecution
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/actions",
  ...mw,
  AutomationOrchestratorController.listActionsCatalog
);

automationOrchestratorRoutes.post(
  "/automation/orchestrator/simulate",
  ...mwTester,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  AutomationOrchestratorController.simulatePlan
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/settings",
  ...mw,
  AutomationOrchestratorController.getSettings
);

automationOrchestratorRoutes.put(
  "/automation/orchestrator/settings",
  ...mw,
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  AutomationOrchestratorController.updateSettings
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/validations",
  ...mw,
  AutomationOrchestratorController.listValidations
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/activation-metrics",
  ...mw,
  AutomationOrchestratorController.activationMetrics
);

export default automationOrchestratorRoutes;
