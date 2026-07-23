import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import * as LiveCtrl from "../controllers/AutomationLiveRolloutController";

const automationLiveRolloutRoutes = Router();
const mw = agentOsStacks.core()

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

automationLiveRolloutRoutes.get(
  "/automation/live/health",
  ...mw,
  LiveCtrl.liveHealth
);

export default automationLiveRolloutRoutes;
