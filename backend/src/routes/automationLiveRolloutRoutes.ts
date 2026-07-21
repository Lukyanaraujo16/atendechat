import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import requireTenantAdminOrSupport from "../middleware/requireTenantAdminOrSupport";
import * as LiveCtrl from "../controllers/AutomationLiveRolloutController";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../config/automationOrchestratorConstants";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../config/automationToolConstants";

const automationLiveRolloutRoutes = Router();
const requireAiAgent = requireEffectiveModule(AUTOMATION_ORCHESTRATOR_FEATURE_KEY);
const requireAiTools = requireEffectiveModule(AUTOMATION_AI_TOOLS_FEATURE_KEY);
const requireAdmin = requireTenantAdminOrSupport;
const mw = [isAuth, requireAiAgent, requireAiTools, requireAdmin] as const;

automationLiveRolloutRoutes.get(
  "/automation/live-rollout",
  ...mw,
  LiveCtrl.getRollout
);

automationLiveRolloutRoutes.put(
  "/automation/live-rollout",
  ...mw,
  LiveCtrl.updateRollout
);

automationLiveRolloutRoutes.get(
  "/automation/live-readiness",
  ...mw,
  LiveCtrl.readiness
);

automationLiveRolloutRoutes.get(
  "/automation/live-eligibility",
  ...mw,
  LiveCtrl.eligibility
);

automationLiveRolloutRoutes.post(
  "/automation/live/test",
  ...mw,
  LiveCtrl.testLive
);

automationLiveRolloutRoutes.post(
  "/automation/live/rollback",
  ...mw,
  LiveCtrl.rollback
);

automationLiveRolloutRoutes.post(
  "/automation/live/fallback",
  ...mw,
  LiveCtrl.fallback
);

automationLiveRolloutRoutes.post(
  "/automation/live/kill-switch",
  ...mw,
  LiveCtrl.killSwitch
);

automationLiveRolloutRoutes.put(
  "/automation/live/company-setting",
  ...mw,
  LiveCtrl.companySetting
);

automationLiveRolloutRoutes.put(
  "/automation/live/agents/:agentId",
  ...mw,
  LiveCtrl.agentSetting
);

automationLiveRolloutRoutes.put(
  "/automation/live/connections/:whatsappId",
  ...mw,
  LiveCtrl.connectionSetting
);

automationLiveRolloutRoutes.get(
  "/automation/live/targets",
  ...mw,
  LiveCtrl.targets
);

automationLiveRolloutRoutes.post(
  "/automation/live/progressive/advance",
  ...mw,
  LiveCtrl.advanceProgressive
);

export default automationLiveRolloutRoutes;
