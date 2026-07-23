/**
 * Smoke + HTTP e2e gaps Wave 5 (tenant bypass / defaults).
 * Usa serviços diretamente (sem servidor HTTP) para CI estável.
 */
process.env.NODE_ENV = "test";
process.env.AGENTOS_PERSISTENCE = "memory";

import { evaluateCapability } from "../CapabilityGates";
import { loadRolloutConfig, transitionRollout, resetRolloutMemory } from "../RolloutStateMachine";
import { setKillSwitch, resetKillSwitchesForTests } from "../KillSwitchService";
import { DEFAULT_AGENTOS_PRODUCTION_FLAGS } from "../../../../config/automationAgentOsProductionConstants";

describe("AgentOS Wave 5 smoke / e2e gaps", () => {
  const companyA = 92001;
  const companyB = 92002;

  beforeEach(async () => {
    resetRolloutMemory();
    await resetKillSwitchesForTests();
  });

  it("1-3 health defaults: rollout DISABLED, live deny", async () => {
    const cfg = await loadRolloutConfig(companyA);
    expect(cfg.rolloutState).toBe("DISABLED");
    expect(DEFAULT_AGENTOS_PRODUCTION_FLAGS.liveEnabled).toBe(false);
  });

  it("6-8 rollout disabled deny; shadow allow inference; live deny", async () => {
    let live = await evaluateCapability({
      companyId: companyA,
      capability: "live_response"
    });
    expect(live.allowed).toBe(false);

    await transitionRollout({
      companyId: companyA,
      to: "INTERNAL_ONLY",
      expectedVersion: 1,
      userId: 1,
      reason: "smoke internal",
      confirm: true
    });
    const cfg = await loadRolloutConfig(companyA);
    await transitionRollout({
      companyId: companyA,
      to: "SHADOW",
      expectedVersion: cfg.version,
      userId: 1,
      reason: "smoke shadow",
      confirm: true,
      acceptWarnings: true
    });
    const shadow = await evaluateCapability({
      companyId: companyA,
      capability: "shadow_inference"
    });
    live = await evaluateCapability({
      companyId: companyA,
      capability: "live_response"
    });
    expect(shadow.allowed).toBe(true);
    expect(live.allowed).toBe(false);
  });

  it("10-12 tool/mcp write negados; coordinator negado", async () => {
    const tw = await evaluateCapability({ companyId: companyA, capability: "tool_write" });
    const mw = await evaluateCapability({ companyId: companyA, capability: "mcp_write" });
    const coord = await evaluateCapability({ companyId: companyA, capability: "coordinator" });
    expect(tw.allowed).toBe(false);
    expect(mw.allowed).toBe(false);
    expect(coord.allowed).toBe(false);
  });

  it("20 kill switch + 28 cross-tenant deny isolation", async () => {
    await setKillSwitch({
      companyId: companyA,
      scope: "tenant",
      resourceId: String(companyA),
      enabled: true,
      reason: "smoke kill",
      userId: 1,
      confirm: true
    });
    const a = await evaluateCapability({
      companyId: companyA,
      capability: "admin_operations"
    });
    // kill blocks even admin_operations productive path via resolveKill first
    expect(a.allowed).toBe(false);

    const b = await evaluateCapability({
      companyId: companyB,
      capability: "admin_operations"
    });
    // company B sem kill — admin_ops ok em DISABLED
    expect(b.allowed).toBe(true);
  });
});
