/**
 * Fase 2.2 — Live Rollout / Eligibility / Canary
 */
import {
  canaryBucket,
  isInCanaryPercent,
  evaluateCanary
} from "../LiveCanary";
import {
  __resetLiveKillSwitchForTests,
  isKillSwitchActive,
  mergeLiveRolloutConfig,
  setKillSwitch
} from "../LiveRolloutConfigService";
import {
  __resetLiveRolloutMetricsForTests,
  getLiveRolloutMetricsSnapshot,
  recordLiveEligibility,
  recordLiveFcExecution
} from "../LiveRolloutMetrics";
import { DEFAULT_LIVE_ROLLOUT_CONFIG } from "../../../../config/automationLiveRolloutConstants";
import { selectToolsForFunctionCalling } from "../../tools/functionCalling/AutomationToolSelectionEngine";
import { buildFunctionCallingToolContext } from "../../tools/functionCalling/AutomationFunctionCallResolver";
import {
  registerBuiltinTools,
  resetBuiltinToolsRegistration
} from "../../tools/registerBuiltinTools";
import { clearToolRegistry } from "../../tools/ToolRegistry";
import { AUTOMATION_ORCHESTRATOR_FEATURE_KEY } from "../../../../config/automationOrchestratorConstants";
import { AUTOMATION_AI_TOOLS_FEATURE_KEY } from "../../../../config/automationToolConstants";
import { __resetToolCircuitBreakerForTests } from "../../tools/ToolCircuitBreaker";
import { __resetToolRateLimitForTests } from "../../tools/ToolRateLimit";
import { __resetToolMetricsForTests } from "../../tools/ToolMetrics";
import { __resetToolEventsForTests } from "../../tools/ToolEventBus";

describe("Live Rollout 2.2", () => {
  beforeEach(() => {
    __resetLiveKillSwitchForTests();
    __resetLiveRolloutMetricsForTests();
    resetBuiltinToolsRegistration();
    clearToolRegistry();
    __resetToolCircuitBreakerForTests();
    __resetToolRateLimitForTests();
    __resetToolMetricsForTests();
    __resetToolEventsForTests();
    registerBuiltinTools();
  });

  it("canary hash é determinístico", () => {
    const a = canaryBucket({
      companyId: 1,
      ticketId: 42,
      messageId: "abc"
    });
    const b = canaryBucket({
      companyId: 1,
      ticketId: 42,
      messageId: "abc"
    });
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });

  it("percentual canary respeita bucket", () => {
    expect(isInCanaryPercent(4, 5)).toBe(true);
    expect(isInCanaryPercent(5, 5)).toBe(false);
    expect(isInCanaryPercent(0, 0)).toBe(false);
    expect(isInCanaryPercent(99, 100)).toBe(true);
  });

  it("evaluateCanary FULL = 100%", () => {
    const r = evaluateCanary({
      stage: "FULL",
      percent: 5,
      companyId: 1,
      ticketId: 1,
      messageId: "x"
    });
    expect(r.effectivePercent).toBe(100);
    expect(r.eligible).toBe(true);
  });

  it("evaluateCanary DISABLED nunca elegível", () => {
    const r = evaluateCanary({
      stage: "DISABLED",
      percent: 100,
      companyId: 1,
      ticketId: 1
    });
    expect(r.eligible).toBe(false);
  });

  it("kill switch company bloqueia", () => {
    setKillSwitch({ scope: "company", companyId: 7, enabled: true });
    const k = isKillSwitchActive({ companyId: 7 });
    expect(k.active).toBe(true);
    expect(k.scope).toBe("company");
  });

  it("kill switch global bloqueia qualquer empresa", () => {
    setKillSwitch({ scope: "global", enabled: true });
    expect(isKillSwitchActive({ companyId: 99 }).active).toBe(true);
  });

  it("config default tem Write Tools OFF e stage DISABLED", () => {
    const cfg = mergeLiveRolloutConfig({});
    expect(cfg.stage).toBe("DISABLED");
    expect(cfg.allowWriteToolsLive).toBe(false);
    expect(cfg.percent).toBe(0);
    expect(DEFAULT_LIVE_ROLLOUT_CONFIG.allowWriteToolsLive).toBe(false);
  });

  it("Selection origin live só read tools", () => {
    const ctx = buildFunctionCallingToolContext({
      companyId: 1,
      allowedToolKeys: [],
      source: "live",
      featureFlags: {
        [AUTOMATION_ORCHESTRATOR_FEATURE_KEY]: true,
        [AUTOMATION_AI_TOOLS_FEATURE_KEY]: true,
        "automation.knowledge_base": true
      }
    });
    const selection = selectToolsForFunctionCalling({
      ctx,
      origin: "live",
      provider: "openai",
      companyPolicy: {
        enabled: true,
        maxRiskLevel: "read_only",
        allowWrite: false
      }
    });
    expect(selection.tools.length).toBeGreaterThan(0);
    expect(
      selection.tools.every(t => t.sideEffectType !== "database_write")
    ).toBe(true);
    expect(selection.tools.some(t => t.id === "ticket.transfer")).toBe(false);
  });

  it("métricas live rollout", () => {
    recordLiveEligibility({
      companyId: 3,
      eligible: true,
      canaryIn: true,
      stage: "CANARY"
    });
    recordLiveEligibility({
      companyId: 3,
      eligible: false,
      canaryIn: false,
      stage: "CANARY"
    });
    recordLiveFcExecution({
      companyId: 3,
      provider: "openai",
      stage: "CANARY",
      toolCallCount: 1,
      latencyMs: 200,
      fallback: true
    });
    const snap = getLiveRolloutMetricsSnapshot(3);
    expect(snap.eligibleExecutions).toBe(1);
    expect(snap.ineligibleExecutions).toBe(1);
    expect(snap.fallbacks).toBe(1);
    expect(snap.liveExecutions).toBe(1);
  });
});
