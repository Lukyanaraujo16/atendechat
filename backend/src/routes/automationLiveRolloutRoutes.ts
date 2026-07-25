import { Router } from "express";
import { agentOsStacks } from "../middleware/agentOsAdminStack";
import {
  requireAgentOsManage,
  requireAgentOsRolloutManage
} from "../middleware/requirePlatformPermission";
import { logAgentOsTechnicalWrite } from "../middleware/logAgentOsTechnicalWrite";
import * as LiveCtrl from "../controllers/AutomationLiveRolloutController";

const automationLiveRolloutRoutes = Router();
const mw = agentOsStacks.core();
const audit = (a: string) => logAgentOsTechnicalWrite(a);

automationLiveRolloutRoutes.get(
  "/automation/live-rollout",
  ...mw,
  LiveCtrl.getRollout
);

automationLiveRolloutRoutes.put(
  "/automation/live-rollout",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
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
  requireAgentOsManage,
  audit("agentOS.console.manage"),
  LiveCtrl.testLive
);

automationLiveRolloutRoutes.post(
  "/automation/live/rollback",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  LiveCtrl.rollback
);

automationLiveRolloutRoutes.post(
  "/automation/live/fallback",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  LiveCtrl.fallback
);

automationLiveRolloutRoutes.post(
  "/automation/live/kill-switch",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  LiveCtrl.killSwitch
);

automationLiveRolloutRoutes.put(
  "/automation/live/company-setting",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  LiveCtrl.companySetting
);

automationLiveRolloutRoutes.put(
  "/automation/live/agents/:agentId",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  LiveCtrl.agentSetting
);

automationLiveRolloutRoutes.put(
  "/automation/live/connections/:whatsappId",
  ...mw,
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
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
  requireAgentOsRolloutManage,
  audit("agentOS.rollout.manage"),
  LiveCtrl.advanceProgressive
);

automationLiveRolloutRoutes.get(
  "/automation/live/health",
  ...mw,
  LiveCtrl.liveHealth
);

export default automationLiveRolloutRoutes;
