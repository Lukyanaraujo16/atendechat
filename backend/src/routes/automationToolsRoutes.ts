import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as AutomationToolsController from "../controllers/AutomationToolsController";

const automationToolsRoutes = Router();
const mw = agentOsStacks.tester()

automationToolsRoutes.get(
  "/automation/tools/catalog",
  ...mw,
  AutomationToolsController.catalog
);

automationToolsRoutes.get(
  "/automation/tools/executions",
  ...mw,
  AutomationToolsController.listExecutions
);

automationToolsRoutes.get(
  "/automation/tools/executions/:id",
  ...mw,
  AutomationToolsController.showExecution
);

automationToolsRoutes.post(
  "/automation/tools/test/:toolId",
  ...mw,
  AutomationToolsController.testTool
);

automationToolsRoutes.get(
  "/automation/tools/policies",
  ...mw,
  AutomationToolsController.getPolicies
);

automationToolsRoutes.put(
  "/automation/tools/policies",
  ...mw,
  AutomationToolsController.updatePolicies
);

automationToolsRoutes.get(
  "/automation/tools/metrics",
  ...mw,
  AutomationToolsController.metrics
);

automationToolsRoutes.post(
  "/automation/tools/function-calling/test",
  ...mw,
  AutomationToolsController.testFunctionCalling
);

export default automationToolsRoutes;
