import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as AutomationEvidenceController from "../controllers/AutomationEvidenceController";

const automationEvidenceRoutes = Router();

const mw = agentOsStacks.monitor()

automationEvidenceRoutes.get(
  "/automation/evidence/dashboard",
  ...mw,
  AutomationEvidenceController.dashboard
);

automationEvidenceRoutes.get(
  "/automation/evidence/readiness",
  ...mw,
  AutomationEvidenceController.readiness
);

automationEvidenceRoutes.get(
  "/automation/evidence/recommendations",
  ...mw,
  AutomationEvidenceController.recommendations
);

automationEvidenceRoutes.get(
  "/automation/evidence/providers",
  ...mw,
  AutomationEvidenceController.providers
);

automationEvidenceRoutes.get(
  "/automation/evidence/tools",
  ...mw,
  AutomationEvidenceController.tools
);

automationEvidenceRoutes.get(
  "/automation/evidence/agents",
  ...mw,
  AutomationEvidenceController.agents
);

automationEvidenceRoutes.get(
  "/automation/evidence/companies",
  ...mw,
  AutomationEvidenceController.companies
);

automationEvidenceRoutes.get(
  "/automation/evidence/connections",
  ...mw,
  AutomationEvidenceController.connections
);

automationEvidenceRoutes.get(
  "/automation/evidence/thresholds",
  ...mw,
  AutomationEvidenceController.thresholds
);

automationEvidenceRoutes.put(
  "/automation/evidence/thresholds",
  ...mw,
  AutomationEvidenceController.updateThresholds
);

automationEvidenceRoutes.get(
  "/automation/evidence/reports/:id",
  ...mw,
  AutomationEvidenceController.showReport
);

automationEvidenceRoutes.get(
  "/automation/evidence/by-shadow-evaluation/:shadowEvaluationId",
  ...mw,
  AutomationEvidenceController.byShadowEvaluation
);

automationEvidenceRoutes.post(
  "/automation/evidence/test",
  ...mw,
  AutomationEvidenceController.testEvidence
);

export default automationEvidenceRoutes;
