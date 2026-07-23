import api from "./api";

export function getProductionDashboard() {
  return api.get("/automation/production");
}

export function getProductionReadiness() {
  return api.get("/automation/production-readiness");
}

export function getRollout() {
  return api.get("/automation/rollout");
}

export function getRolloutHistory() {
  return api.get("/automation/rollout/history");
}

export function runRolloutPreflight() {
  return api.post("/automation/rollout/preflight", { confirm: true });
}

export function transitionRollout(data) {
  return api.post("/automation/rollout/transition", { ...data, confirm: true });
}

export function suspendRollout(data) {
  return api.post("/automation/rollout/suspend", { ...data, confirm: true });
}

export function resumeRollout(data) {
  return api.post("/automation/rollout/resume", { ...data, confirm: true });
}

export function rollbackRollout(data) {
  return api.post("/automation/rollout/rollback", { ...data, confirm: true });
}

export function listKillSwitches() {
  return api.get("/automation/kill-switches");
}

export function setKillSwitch(data) {
  return api.post("/automation/kill-switches", { ...data, confirm: true });
}

export function emergencyStop(data) {
  return api.post("/automation/emergency-stop", { ...data, confirm: true });
}

export function listIncidents(params = {}) {
  return api.get("/automation/incidents", { params });
}

export function acknowledgeIncident(id) {
  return api.post(`/automation/incidents/${id}/acknowledge`, { confirm: true });
}

export function resolveIncident(id, resolution) {
  return api.post(`/automation/incidents/${id}/resolve`, {
    resolution,
    confirm: true,
  });
}

export function checkReleaseReadiness() {
  return api.post("/automation/release-readiness/check", { confirm: true });
}

export function getEvidencePackage() {
  return api.get("/automation/evidence-package");
}

export function hydrateAgentOs() {
  return api.post("/automation/hydrate", { confirm: true });
}
