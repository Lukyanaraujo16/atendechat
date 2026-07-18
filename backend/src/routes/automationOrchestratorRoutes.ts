import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import requireTenantAdminOrSupport from "../middleware/requireTenantAdminOrSupport";
import * as AutomationOrchestratorController from "../controllers/AutomationOrchestratorController";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../config/automationOrchestratorConstants";

const automationOrchestratorRoutes = Router();
const requireAiAgent = requireEffectiveModule(AUTOMATION_ORCHESTRATOR_FEATURE_KEY);
const requireAdmin = requireTenantAdminOrSupport;

automationOrchestratorRoutes.get(
  "/automation/orchestrator/dashboard",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.dashboard
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/executions",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.listExecutions
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/executions/:id",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.showExecution
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/executions/:id/replay",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.replayExecution
);

automationOrchestratorRoutes.post(
  "/automation/orchestrator/executions/:id/continue",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.continueExecution
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/actions",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.listActionsCatalog
);

automationOrchestratorRoutes.post(
  "/automation/orchestrator/simulate",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.simulatePlan
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/settings",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.getSettings
);

automationOrchestratorRoutes.put(
  "/automation/orchestrator/settings",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.updateSettings
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/validations",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.listValidations
);

automationOrchestratorRoutes.get(
  "/automation/orchestrator/activation-metrics",
  isAuth,
  requireAiAgent,
  requireAdmin,
  AutomationOrchestratorController.activationMetrics
);

export default automationOrchestratorRoutes;
