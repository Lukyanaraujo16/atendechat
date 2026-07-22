import api from "./api";

export function getLiveRolloutDashboard() {
  return api.get("/automation/live-rollout");
}

export function updateLiveRollout(config) {
  return api.put("/automation/live-rollout", { config });
}

export function getLiveReadiness() {
  return api.get("/automation/live-readiness");
}

export function getLiveEligibility(params = {}) {
  return api.get("/automation/live-eligibility", { params });
}

export function testLiveRollout(data) {
  return api.post("/automation/live/test", data);
}

export function postLiveRollback() {
  return api.post("/automation/live/rollback");
}

export function postLiveFallback(data = {}) {
  return api.post("/automation/live/fallback", data);
}

export function postLiveKillSwitch(data) {
  return api.post("/automation/live/kill-switch", data);
}

export function updateLiveCompanySetting(data) {
  return api.put("/automation/live/company-setting", data);
}

export function updateLiveAgentSetting(agentId, data) {
  return api.put(`/automation/live/agents/${agentId}`, data);
}

export function updateLiveConnectionSetting(whatsappId, data) {
  return api.put(`/automation/live/connections/${whatsappId}`, data);
}

export function getLiveTargets() {
  return api.get("/automation/live/targets");
}

export function advanceLiveProgressive() {
  return api.post("/automation/live/progressive/advance");
}

export function getLiveHealth() {
  return api.get("/automation/live/health");
}
