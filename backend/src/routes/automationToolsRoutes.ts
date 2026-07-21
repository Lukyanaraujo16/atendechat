import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import requireTenantAdminOrSupport from "../middleware/requireTenantAdminOrSupport";
import * as AutomationToolsController from "../controllers/AutomationToolsController";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../config/automationOrchestratorConstants";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../config/automationToolConstants";

const automationToolsRoutes = Router();
const requireAiAgent = requireEffectiveModule(AUTOMATION_ORCHESTRATOR_FEATURE_KEY);
const requireAiTools = requireEffectiveModule(AUTOMATION_AI_TOOLS_FEATURE_KEY);
const requireAdmin = requireTenantAdminOrSupport;

automationToolsRoutes.get(
  "/automation/tools/catalog",
  isAuth,
  requireAiAgent,
  requireAiTools,
  requireAdmin,
  AutomationToolsController.catalog
);

automationToolsRoutes.get(
  "/automation/tools/executions",
  isAuth,
  requireAiAgent,
  requireAiTools,
  requireAdmin,
  AutomationToolsController.listExecutions
);

automationToolsRoutes.get(
  "/automation/tools/executions/:id",
  isAuth,
  requireAiAgent,
  requireAiTools,
  requireAdmin,
  AutomationToolsController.showExecution
);

automationToolsRoutes.post(
  "/automation/tools/test/:toolId",
  isAuth,
  requireAiAgent,
  requireAiTools,
  requireAdmin,
  AutomationToolsController.testTool
);

automationToolsRoutes.get(
  "/automation/tools/policies",
  isAuth,
  requireAiAgent,
  requireAiTools,
  requireAdmin,
  AutomationToolsController.getPolicies
);

automationToolsRoutes.put(
  "/automation/tools/policies",
  isAuth,
  requireAiAgent,
  requireAiTools,
  requireAdmin,
  AutomationToolsController.updatePolicies
);

automationToolsRoutes.get(
  "/automation/tools/metrics",
  isAuth,
  requireAiAgent,
  requireAiTools,
  requireAdmin,
  AutomationToolsController.metrics
);

export default automationToolsRoutes;
