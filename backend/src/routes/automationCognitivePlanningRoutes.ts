import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as Ctrl from "../controllers/AutomationCognitivePlanningController";

const automationCognitivePlanningRoutes = Router();
const mw = agentOsStacks.core()

automationCognitivePlanningRoutes.get(
  "/automation/planning/dashboard",
  ...mw,
  Ctrl.dashboard
);

automationCognitivePlanningRoutes.get(
  "/automation/planning/metrics",
  ...mw,
  Ctrl.metrics
);

automationCognitivePlanningRoutes.post(
  "/automation/planning/analyze-goal",
  ...mw,
  Ctrl.analyzeGoal
);

automationCognitivePlanningRoutes.post(
  "/automation/planning/generate-plan",
  ...mw,
  Ctrl.generatePlan
);

automationCognitivePlanningRoutes.post(
  "/automation/planning/dependencies",
  ...mw,
  Ctrl.dependencies
);

automationCognitivePlanningRoutes.get(
  "/automation/planning/dependencies",
  ...mw,
  Ctrl.dependencies
);

automationCognitivePlanningRoutes.post(
  "/automation/planning/validate",
  ...mw,
  Ctrl.validate
);

automationCognitivePlanningRoutes.post(
  "/automation/planning/recovery",
  ...mw,
  Ctrl.recovery
);

automationCognitivePlanningRoutes.post(
  "/automation/planning/replay",
  ...mw,
  Ctrl.replay
);

automationCognitivePlanningRoutes.post(
  "/automation/planning/evaluate",
  ...mw,
  Ctrl.evaluate
);

automationCognitivePlanningRoutes.get(
  "/automation/planning/evaluations",
  ...mw,
  Ctrl.listEvaluations
);

automationCognitivePlanningRoutes.get(
  "/automation/planning/evaluations/:id",
  ...mw,
  Ctrl.showEvaluation
);

automationCognitivePlanningRoutes.get(
  "/automation/planning/evaluation/dashboard",
  ...mw,
  Ctrl.evaluationDashboard
);

automationCognitivePlanningRoutes.get(
  "/automation/planning/evaluation/config",
  ...mw,
  Ctrl.evaluationConfig
);

automationCognitivePlanningRoutes.put(
  "/automation/planning/evaluation/config",
  ...mw,
  Ctrl.evaluationConfig
);

automationCognitivePlanningRoutes.post(
  "/automation/planning/diff",
  ...mw,
  Ctrl.planDiff
);

export default automationCognitivePlanningRoutes;
