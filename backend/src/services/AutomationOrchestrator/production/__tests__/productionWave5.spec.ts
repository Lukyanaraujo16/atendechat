/**
 * AI Agent V2.10 Wave 5 — Production Readiness tests.
 * Sem mudança cognitiva. Defaults OFF.
 */
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.AGENTOS_PERSISTENCE = process.env.AGENTOS_PERSISTENCE || "memory";

import {
  DEFAULT_AGENTOS_PRODUCTION_FLAGS,
  AGENTOS_ROLLOUT_TRANSITIONS,
  defaultRolloutConfig
} from "../../../../config/automationAgentOsProductionConstants";
import {
  assertValidTransition,
  loadRolloutConfig,
  transitionRollout,
  resetRolloutMemory
} from "../RolloutStateMachine";
import {
  setKillSwitch,
  resolveKillSwitch,
  emergencyStop,
  listKillSwitches,
  resetKillSwitchesForTests
} from "../KillSwitchService";
import { evaluateCapability, evaluateLiveResponseGate } from "../CapabilityGates";
import { runPreflight, runReleaseReadiness, validateEnvironment } from "../PreflightAndReadiness";
import { evaluateCanary } from "../CanaryEvaluator";
import { triggerAutoRollback } from "../AutoRollback";
import { openIncident, listIncidents, acknowledgeIncident, resolveIncident, resetIncidents } from "../IncidentService";
import { resetHydrationFlags, hydrateAgentOsTenant } from "../DbFirstHydration";
import { evaluateCostLimit } from "../CostControls";
import {
  getOrCreateReleaseCandidate,
  buildEvidencePackage,
  getGoLiveChecklist,
  resetReleaseCandidateForTests
} from "../ReleaseCandidateService";
import { __resetProductionAdminForTests } from "../ProductionAdminServices";
import AppError from "../../../../errors/AppError";

describe("AgentOS Wave 5 Production Readiness", () => {
  const companyId = 91005;

  beforeEach(async () => {
    resetRolloutMemory();
    resetIncidents();
    resetHydrationFlags();
    resetReleaseCandidateForTests();
    __resetProductionAdminForTests();
    await resetKillSwitchesForTests();
  });

  it("defaults oficiais permanecem false / DISABLED", () => {
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.globalEnabled).toBe(false);
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.liveEnabled).toBe(false);
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.multiAgentLiveEnabled).toBe(false);
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.coordinatorLiveEnabled).toBe(false);
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.learningAutoPromotionEnabled).toBe(false);
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.mcpWriteEnabled).toBe(false);
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.toolWriteEnabled).toBe(false);
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.autoRollbackEnabled).toBe(false);
    expect(defaultRolloutConfig(companyId).rolloutState).toBe("DISABLED");
  });

  it("state machine bloqueia salto inseguro DISABLED → CONTROLLED_PRODUCTION", () => {
    expect(() =>
      assertValidTransition("DISABLED", "CONTROLLED_PRODUCTION")
    ).toThrow(AppError);
    expect(AGENTOS_ROLLOUT_TRANSITIONS.DISABLED).toEqual(["INTERNAL_ONLY"]);
  });

  it("transição válida DISABLED → INTERNAL_ONLY", async () => {
    const cfg = await transitionRollout({
      companyId,
      to: "INTERNAL_ONLY",
      expectedVersion: 1,
      userId: 1,
      reason: "teste interno",
      confirm: true
    });
    expect(cfg.rolloutState).toBe("INTERNAL_ONLY");
    expect(cfg.flags.liveEnabled).toBe(false);
  });

  it("exige confirmação e motivo", async () => {
    await expect(
      transitionRollout({
        companyId,
        to: "INTERNAL_ONLY",
        expectedVersion: 1,
        userId: 1,
        reason: "ok",
        confirm: false
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("capability gates negam live/tool write/mcp write por default", async () => {
    const live = await evaluateLiveResponseGate({ companyId });
    const tool = await evaluateCapability({ companyId, capability: "tool_write" });
    const mcp = await evaluateCapability({ companyId, capability: "mcp_write" });
    expect(live.allowed).toBe(false);
    expect(tool.allowed).toBe(false);
    expect(mcp.allowed).toBe(false);
  });

  it("kill switch tenant nega execução", async () => {
    await setKillSwitch({
      companyId,
      scope: "tenant",
      resourceId: String(companyId),
      enabled: true,
      reason: "teste kill",
      userId: 1,
      confirm: true
    });
    const r = await resolveKillSwitch({ companyId, component: "agentos" });
    expect(r.denied).toBe(true);
    const live = await evaluateCapability({ companyId, capability: "shadow_inference" });
    expect(live.allowed).toBe(false);
  });

  it("emergency stop suspende e mata writes/live", async () => {
    await transitionRollout({
      companyId,
      to: "INTERNAL_ONLY",
      expectedVersion: 1,
      userId: 1,
      reason: "prep emergency",
      confirm: true
    });
    const result = await emergencyStop({
      companyId,
      userId: 1,
      reason: "incidente teste",
      confirm: true
    });
    expect(result.ok).toBe(true);
    const cfg = await loadRolloutConfig(companyId);
    expect(cfg.rolloutState).toBe("SUSPENDED");
    expect(cfg.flags.liveEnabled).toBe(false);
  });

  it("preflight e release readiness executam", async () => {
    const pf = await runPreflight(companyId);
    expect(["PASS", "PASS_WITH_WARNINGS", "FAIL"]).toContain(pf.status);
    const rr = await runReleaseReadiness(companyId);
    expect(["READY", "READY_WITH_WARNINGS", "NOT_READY", "BLOCKED"]).toContain(
      rr.status
    );
    const env = validateEnvironment();
    expect(env.length).toBeGreaterThan(0);
    expect(env.every(e => !("value" in e))).toBe(true);
  });

  it("auto rollback permanece desabilitado por padrão", async () => {
    const r = await triggerAutoRollback({
      companyId,
      reasonCodes: ["TEST"],
      source: "test"
    });
    expect(r.triggered).toBe(false);
  });

  it("canary evaluator retorna health com reason codes", async () => {
    const c = await evaluateCanary(companyId);
    expect(["HEALTHY", "WARNING", "UNHEALTHY", "INSUFFICIENT_DATA"]).toContain(
      c.health
    );
    expect(Array.isArray(c.reasonCodes)).toBe(true);
  });

  it("incidents open/ack/resolve", async () => {
    const i = await openIncident({
      companyId,
      type: "TEST",
      title: "t",
      description: "d"
    });
    expect(listIncidents(companyId).length).toBeGreaterThan(0);
    acknowledgeIncident(i.incidentId, 1);
    resolveIncident(i.incidentId, "ok");
    expect(listIncidents(companyId)[0].status).toBe("RESOLVED");
  });

  it("hydrate tenant é idempotente em memory mode", async () => {
    const a = await hydrateAgentOsTenant(companyId);
    const b = await hydrateAgentOsTenant(companyId);
    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
  });

  it("cost controls retornam UNKNOWN sem maxDailyCost", async () => {
    const c = await evaluateCostLimit(companyId);
    expect(c.state).toBe("UNKNOWN");
  });

  it("release candidate nunca auto-aprova", async () => {
    const rc = await getOrCreateReleaseCandidate(companyId);
    expect(rc.status).not.toBe("APPROVED");
    const ev = await buildEvidencePackage(companyId);
    expect(ev.markdown).toContain("Release Candidate");
    expect(getGoLiveChecklist(companyId).length).toBeGreaterThan(20);
  });

  it("SHADOW bloqueia live e writes", async () => {
    await transitionRollout({
      companyId,
      to: "INTERNAL_ONLY",
      expectedVersion: 1,
      userId: 1,
      reason: "shadow path",
      confirm: true
    });
    const cfg = await loadRolloutConfig(companyId);
    await transitionRollout({
      companyId,
      to: "SHADOW",
      expectedVersion: cfg.version,
      userId: 1,
      reason: "entrar shadow",
      confirm: true,
      acceptWarnings: true
    });
    const live = await evaluateCapability({ companyId, capability: "live_response" });
    const tw = await evaluateCapability({ companyId, capability: "tool_write" });
    expect(live.allowed).toBe(false);
    expect(tw.allowed).toBe(false);
  });

  it("tenant isolation em kill list", async () => {
    await setKillSwitch({
      companyId,
      scope: "tenant",
      resourceId: String(companyId),
      enabled: true,
      reason: "iso",
      userId: 1,
      confirm: true
    });
    const other = await listKillSwitches(companyId + 1);
    expect(other.tenant.every(e => e.resourceId !== String(companyId) || !e.enabled)).toBe(
      true
    );
  });
});
