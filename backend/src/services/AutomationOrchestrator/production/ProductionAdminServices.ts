import AppError from "../../../errors/AppError";
import {
  AgentOsRolloutState,
  AGENTOS_ROLLOUT_TRANSITIONS,
  DEFAULT_AGENTOS_PRODUCTION_FLAGS,
  AGENTOS_PRODUCTION_PERMISSIONS
} from "../../../config/automationAgentOsProductionConstants";
import {
  loadRolloutConfig,
  saveRolloutConfig,
  transitionRollout,
  resetRolloutMemory
} from "./RolloutStateMachine";
import {
  listKillSwitches,
  setKillSwitch,
  emergencyStop,
  resolveKillSwitch
} from "./KillSwitchService";
import { evaluateCapability, evaluateLiveResponseGate } from "./CapabilityGates";
import {
  runPreflight,
  runReleaseReadiness,
  validateEnvironment
} from "./PreflightAndReadiness";
import { evaluateCanary } from "./CanaryEvaluator";
import { triggerAutoRollback } from "./AutoRollback";
import {
  listIncidents,
  getIncident,
  acknowledgeIncident,
  resolveIncident,
  openIncident
} from "./IncidentService";
import { hydrateAgentOsTenant } from "./DbFirstHydration";
import { evaluateCostLimit } from "./CostControls";
import {
  getOrCreateReleaseCandidate,
  buildEvidencePackage,
  getGoLiveChecklist,
  updateChecklistItem
} from "./ReleaseCandidateService";

const historyMem = new Map<number, Array<Record<string, unknown>>>();

function pushHistory(companyId: number, entry: Record<string, unknown>) {
  const list = historyMem.get(companyId) || [];
  list.unshift({ ...entry, at: new Date().toISOString() });
  historyMem.set(companyId, list.slice(0, 100));
}

export async function GetProductionDashboardService(input: {
  companyId: number;
  isSuper?: boolean;
}) {
  const rollout = await loadRolloutConfig(input.companyId);
  const readiness = await runReleaseReadiness(input.companyId);
  const kill = await listKillSwitches(input.companyId);
  const canary = await evaluateCanary(input.companyId);
  const incidents = listIncidents(input.companyId, 20);
  const cost = await evaluateCostLimit(input.companyId);
  const liveGate = await evaluateLiveResponseGate({ companyId: input.companyId });
  const toolWrite = await evaluateCapability({
    companyId: input.companyId,
    capability: "tool_write"
  });
  const mcpWrite = await evaluateCapability({
    companyId: input.companyId,
    capability: "mcp_write"
  });
  const rc = await getOrCreateReleaseCandidate(input.companyId);

  return {
    defaults: DEFAULT_AGENTOS_PRODUCTION_FLAGS,
    rollout,
    readiness,
    canary,
    killSwitches: kill,
    incidents,
    cost,
    gates: {
      live: liveGate,
      toolWrite,
      mcpWrite
    },
    releaseCandidate: rc,
    checklist: getGoLiveChecklist(input.companyId),
    permissionsCatalog: AGENTOS_PRODUCTION_PERMISSIONS,
    transitionsAllowed: AGENTOS_ROLLOUT_TRANSITIONS[rollout.rolloutState],
    superadmin: input.isSuper
      ? {
          note: "visão agregada sem payloads privados",
          openIncidents: incidents.filter(i => i.status === "OPEN").length,
          rolloutState: rollout.rolloutState,
          readinessStatus: readiness.status
        }
      : undefined
  };
}

export async function GetRolloutService(input: { companyId: number }) {
  return loadRolloutConfig(input.companyId);
}

export async function GetRolloutHistoryService(input: { companyId: number }) {
  return { history: historyMem.get(input.companyId) || [] };
}

export async function RunPreflightService(input: { companyId: number }) {
  const result = await runPreflight(input.companyId);
  pushHistory(input.companyId, { type: "preflight", status: result.status });
  return result;
}

export async function TransitionRolloutService(input: {
  companyId: number;
  to: AgentOsRolloutState;
  expectedVersion: number;
  userId: number;
  reason: string;
  confirm: boolean;
  acceptWarnings?: boolean;
}) {
  const cfg = await transitionRollout(input);
  pushHistory(input.companyId, {
    type: "transition",
    to: input.to,
    version: cfg.version,
    userId: input.userId
  });
  return cfg;
}

export async function SuspendRolloutService(input: {
  companyId: number;
  userId: number;
  reason: string;
  confirm: boolean;
  expectedVersion: number;
}) {
  return TransitionRolloutService({
    ...input,
    to: "SUSPENDED"
  });
}

export async function ResumeRolloutService(input: {
  companyId: number;
  userId: number;
  reason: string;
  confirm: boolean;
  expectedVersion: number;
  to?: AgentOsRolloutState;
}) {
  const cfg = await loadRolloutConfig(input.companyId);
  if (cfg.rolloutState !== "SUSPENDED" && cfg.rolloutState !== "ROLLBACK") {
    throw new AppError("ERR_ROLLOUT_NOT_SUSPENDED", 400);
  }
  const to =
    input.to ||
    (cfg.previousRolloutState && cfg.previousRolloutState !== "SUSPENDED"
      ? cfg.previousRolloutState
      : "DISABLED");
  return TransitionRolloutService({
    companyId: input.companyId,
    to,
    expectedVersion: input.expectedVersion,
    userId: input.userId,
    reason: input.reason,
    confirm: input.confirm,
    acceptWarnings: true
  });
}

export async function RollbackRolloutService(input: {
  companyId: number;
  userId: number;
  reason: string;
  confirm: boolean;
  expectedVersion: number;
}) {
  const cfg = await loadRolloutConfig(input.companyId);
  if (
    !["CANARY", "CONTROLLED_PRODUCTION"].includes(cfg.rolloutState) &&
    cfg.rolloutState !== "TENANT_ALLOWLIST"
  ) {
    // allow forced via transition if valid, else auto-rollback path
    if (!AGENTOS_ROLLOUT_TRANSITIONS[cfg.rolloutState]?.includes("ROLLBACK")) {
      // force via save if coming from SUSPENDED etc.
      cfg.previousRolloutState = cfg.rolloutState;
      cfg.rolloutState = "ROLLBACK";
      cfg.flags.liveEnabled = false;
      cfg.flags.toolWriteEnabled = false;
      cfg.flags.mcpWriteEnabled = false;
      cfg.version += 1;
      cfg.suspendedReason = input.reason;
      await saveRolloutConfig(cfg, input.userId);
      pushHistory(input.companyId, { type: "rollback", reason: input.reason });
      return cfg;
    }
  }
  return TransitionRolloutService({
    ...input,
    to: "ROLLBACK"
  });
}

export async function ListKillSwitchesService(input: { companyId: number }) {
  return listKillSwitches(input.companyId);
}

export async function SetKillSwitchService(input: {
  companyId: number;
  scope: any;
  resourceId: string;
  enabled: boolean;
  reason: string;
  userId: number;
  confirm: boolean;
}) {
  return setKillSwitch(input);
}

export async function EmergencyStopService(input: {
  companyId: number;
  userId: number;
  reason: string;
  confirm: boolean;
  scope?: "tenant" | "global";
}) {
  const result = await emergencyStop(input);
  pushHistory(input.companyId, { type: "emergency_stop", reason: input.reason });
  await openIncident({
    companyId: input.companyId,
    severity: "critical",
    type: "EMERGENCY_STOP",
    title: "Emergency stop AgentOS",
    description: input.reason
  });
  return result;
}

export async function ListIncidentsService(input: {
  companyId: number;
  limit?: number;
}) {
  return { incidents: listIncidents(input.companyId, input.limit || 50) };
}

export async function GetIncidentService(input: {
  companyId: number;
  incidentId: string;
}) {
  const i = getIncident(input.incidentId);
  if (!i || (i.companyId != null && i.companyId !== input.companyId)) {
    throw new AppError("ERR_NOT_FOUND", 404);
  }
  return i;
}

export async function AcknowledgeIncidentService(input: {
  companyId: number;
  incidentId: string;
  userId: number;
}) {
  const i = getIncident(input.incidentId);
  if (!i || (i.companyId != null && i.companyId !== input.companyId)) {
    throw new AppError("ERR_NOT_FOUND", 404);
  }
  return acknowledgeIncident(input.incidentId, input.userId);
}

export async function ResolveIncidentService(input: {
  companyId: number;
  incidentId: string;
  resolution: string;
  confirm: boolean;
}) {
  if (input.confirm !== true) throw new AppError("ERR_CONFIRMATION_REQUIRED", 400);
  const i = getIncident(input.incidentId);
  if (!i || (i.companyId != null && i.companyId !== input.companyId)) {
    throw new AppError("ERR_NOT_FOUND", 404);
  }
  return resolveIncident(input.incidentId, input.resolution);
}

export async function GetReleaseReadinessService(input: { companyId: number }) {
  return runReleaseReadiness(input.companyId);
}

export async function CheckReleaseReadinessService(input: {
  companyId: number;
  userId: number;
}) {
  const result = await runReleaseReadiness(input.companyId);
  pushHistory(input.companyId, {
    type: "release_readiness",
    status: result.status,
    userId: input.userId
  });
  return result;
}

export async function GetEnvironmentValidationService() {
  return { variables: validateEnvironment() };
}

export async function GetEvidencePackageService(input: { companyId: number }) {
  return buildEvidencePackage(input.companyId);
}

export async function UpdateChecklistService(input: {
  companyId: number;
  itemId: string;
  status: string;
  justification?: string;
  approverUserId?: number;
}) {
  return updateChecklistItem(input);
}

export async function HydrateTenantService(input: { companyId: number }) {
  return hydrateAgentOsTenant(input.companyId);
}

export async function ResolveKillDecisionService(input: {
  companyId: number;
  component?: string;
}) {
  return resolveKillSwitch(input);
}

export async function TriggerManualAutoRollbackService(input: {
  companyId: number;
  reason: string;
  userId: number;
  confirm: boolean;
}) {
  if (input.confirm !== true) throw new AppError("ERR_CONFIRMATION_REQUIRED", 400);
  return triggerAutoRollback({
    companyId: input.companyId,
    reasonCodes: [input.reason],
    source: "manual",
    userId: input.userId
  });
}

export function __resetProductionAdminForTests() {
  historyMem.clear();
  resetRolloutMemory();
}
