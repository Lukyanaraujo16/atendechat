import { randomBytes } from "crypto";
import {
  AUTOMATION_AGENTOS_VERSION,
  AGENTOS_SCHEMA_VERSION,
  AGENTOS_RC_MODULE_KEY,
  AGENTOS_CHECKLIST_MODULE_KEY,
  ReleaseStatus
} from "../../../config/automationAgentOsProductionConstants";
import { runReleaseReadiness } from "./PreflightAndReadiness";
import { observabilityRepository } from "../persistence/repositories/ObservabilityRepository";

export type ReleaseCandidateStatus =
  | "DRAFT"
  | "VALIDATING"
  | "BLOCKED"
  | "READY_WITH_WARNINGS"
  | "READY"
  | "APPROVED"
  | "REJECTED";

export type ReleaseCandidate = {
  releaseCandidateId: string;
  companyId: number;
  agentOsVersion: string;
  buildVersion: string;
  schemaVersion: string;
  createdAt: string;
  createdBy: number | null;
  status: ReleaseCandidateStatus;
  readinessResult: ReleaseStatus | null;
  warnings: string[];
  blockers: string[];
  testEvidence: string[];
  migrationEvidence: string[];
  securityEvidence: string[];
  performanceEvidence: string[];
  rollbackEvidence: string[];
  backupEvidence: string[];
  approvedAt: string | null;
  approvedBy: number | null;
};

export type ChecklistItemStatus =
  | "PENDING"
  | "PASS"
  | "WARNING"
  | "FAIL"
  | "WAIVED";

export type GoLiveChecklistItem = {
  id: string;
  label: string;
  status: ChecklistItemStatus;
  justification?: string;
  approverUserId?: number;
};

const rcMem = new Map<number, ReleaseCandidate>();
const checklistMem = new Map<number, GoLiveChecklistItem[]>();

const CHECKLIST_DEFAULTS: Array<{ id: string; label: string }> = [
  { id: "code_freeze", label: "código congelado" },
  { id: "build_backend", label: "build backend" },
  { id: "build_frontend", label: "build frontend" },
  { id: "migrations_reviewed", label: "migrations revisadas" },
  { id: "backup_validated", label: "backup validado" },
  { id: "restore_validated", label: "restore validado" },
  { id: "redis", label: "Redis" },
  { id: "queue", label: "queue" },
  { id: "workers", label: "workers" },
  { id: "secrets", label: "secrets" },
  { id: "provider", label: "provider" },
  { id: "mcp", label: "MCP" },
  { id: "feature_flags", label: "feature flags" },
  { id: "plans", label: "planos" },
  { id: "rbac", label: "RBAC" },
  { id: "tenant_isolation", label: "tenant isolation" },
  { id: "rate_limit", label: "rate limit" },
  { id: "idempotency", label: "idempotency" },
  { id: "locks", label: "locks" },
  { id: "observability", label: "observability" },
  { id: "replay", label: "replay" },
  { id: "audit", label: "audit" },
  { id: "metrics", label: "metrics" },
  { id: "alerts", label: "alerts" },
  { id: "incidents", label: "incidents" },
  { id: "runbooks", label: "runbooks" },
  { id: "rollback", label: "rollback" },
  { id: "emergency_stop", label: "emergency stop" },
  { id: "canary_policy", label: "canary policy" },
  { id: "cost_limits", label: "cost limits" },
  { id: "privacy", label: "privacy" },
  { id: "retention", label: "retention" },
  { id: "cleanup_dry_run", label: "cleanup dry-run" },
  { id: "staging", label: "staging" },
  { id: "smoke_tests", label: "smoke tests" },
  { id: "oncall", label: "owner de plantão" },
  { id: "deploy_window", label: "janela de deploy" },
  { id: "communication", label: "comunicação" },
  { id: "approval", label: "approval" }
];

function defaultChecklist(): GoLiveChecklistItem[] {
  return CHECKLIST_DEFAULTS.map(i => ({ ...i, status: "PENDING" as const }));
}

export async function getOrCreateReleaseCandidate(
  companyId: number
): Promise<ReleaseCandidate> {
  if (rcMem.has(companyId)) return rcMem.get(companyId)!;
  const readiness = await runReleaseReadiness(companyId);
  const now = new Date().toISOString();
  let status: ReleaseCandidateStatus = "DRAFT";
  if (readiness.status === "NOT_READY" || readiness.status === "BLOCKED") {
    status = "BLOCKED";
  } else if (readiness.status === "READY_WITH_WARNINGS") {
    status = "READY_WITH_WARNINGS";
  } else if (readiness.status === "READY") {
    status = "READY";
  }
  const rc: ReleaseCandidate = {
    releaseCandidateId: `rc_${Date.now().toString(36)}_${randomBytes(2).toString("hex")}`,
    companyId,
    agentOsVersion: AUTOMATION_AGENTOS_VERSION,
    buildVersion: process.env.AGENTOS_BUILD_VERSION || AUTOMATION_AGENTOS_VERSION,
    schemaVersion: AGENTOS_SCHEMA_VERSION,
    createdAt: now,
    createdBy: null,
    status,
    readinessResult: readiness.status,
    warnings: readiness.warnings.map(w => w.code),
    blockers: readiness.blockers.map(b => b.code),
    testEvidence: ["wave5.unit", "wave2.security", "wave4.scalability"],
    migrationEvidence: [
      "20260722220000",
      "20260723120000",
      "20260723180000",
      "20260723200000"
    ],
    securityEvidence: ["wave2.hardening"],
    performanceEvidence: ["wave4.load"],
    rollbackEvidence: ["rollout.state.machine", "kill.switch"],
    backupEvidence: ["db.backup.includes.agentos.tables"],
    approvedAt: null,
    approvedBy: null
  };
  // Nunca auto-aprovar
  if (rc.status === "APPROVED") rc.status = "READY";
  rcMem.set(companyId, rc);
  observabilityRepository.putSettingFireAndForget(
    companyId,
    AGENTOS_RC_MODULE_KEY,
    rc as any,
    null
  );
  return rc;
}

export async function buildEvidencePackage(companyId: number) {
  const rc = await getOrCreateReleaseCandidate(companyId);
  const readiness = await runReleaseReadiness(companyId);
  const markdown = [
    `# AgentOS Release Candidate Evidence`,
    ``,
    `- RC: ${rc.releaseCandidateId}`,
    `- Version: ${rc.agentOsVersion}`,
    `- Schema: ${rc.schemaVersion}`,
    `- Status: ${rc.status}`,
    `- Readiness: ${readiness.status}`,
    ``,
    `## Blockers`,
    ...(rc.blockers.length ? rc.blockers.map(b => `- ${b}`) : ["- none"]),
    ``,
    `## Warnings`,
    ...(rc.warnings.length ? rc.warnings.map(w => `- ${w}`) : ["- none"]),
    ``,
    `## Evidence refs`,
    `- tests: ${rc.testEvidence.join(", ")}`,
    `- migrations: ${rc.migrationEvidence.join(", ")}`,
    `- security: ${rc.securityEvidence.join(", ")}`,
    `- rollback: ${rc.rollbackEvidence.join(", ")}`,
    `- backup: ${rc.backupEvidence.join(", ")}`,
    ``,
    `Sem segredos neste pacote.`
  ].join("\n");

  return {
    json: { releaseCandidate: rc, readiness },
    markdown
  };
}

export function getGoLiveChecklist(companyId: number): GoLiveChecklistItem[] {
  if (!checklistMem.has(companyId)) {
    checklistMem.set(companyId, defaultChecklist());
  }
  return checklistMem.get(companyId)!;
}

export function updateChecklistItem(input: {
  companyId: number;
  itemId: string;
  status: string;
  justification?: string;
  approverUserId?: number;
}): GoLiveChecklistItem[] {
  const list = getGoLiveChecklist(input.companyId);
  const item = list.find(i => i.id === input.itemId);
  if (!item) return list;
  if (input.status === "WAIVED" && !input.justification) {
    throw new Error("ERR_VALIDATION:WAIVED exige justificativa");
  }
  item.status = input.status as ChecklistItemStatus;
  item.justification = input.justification;
  item.approverUserId = input.approverUserId;
  observabilityRepository.putSettingFireAndForget(
    input.companyId,
    AGENTOS_CHECKLIST_MODULE_KEY,
    { items: list } as any,
    input.approverUserId ?? null
  );
  return list;
}

export function resetReleaseCandidateForTests(): void {
  rcMem.clear();
  checklistMem.clear();
}
