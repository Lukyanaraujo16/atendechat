/**
 * Hardening 2.3.2 — frontend apenas apresenta readiness do backend.
 * Não calcula compatibilidade provider/credencial/modelo.
 */
import {
  mapAiAgentProductSummary,
  mapAiAgentCheck,
  mapAiAgentNextAction,
  buildAiAgentCommercialCommands,
} from "../../utils/aiAgentProductMapper";

describe("aiAgentReadinessCompatibilityPhase232", () => {
  it("apresenta provider desconhecido via checks do backend", () => {
    const mapped = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "attention_required",
      mode: "off",
      agent: { exists: true, id: 1, name: "Bot", enabled: false },
      connection: { linked: true, name: "WA", connected: true },
      connectionScope: {
        type: "all_linked",
        count: 1,
        connectedCount: 1,
        disconnectedCount: 0,
        names: ["WA"],
      },
      agentScope: { type: "single", count: 1 },
      readiness: {
        ready: false,
        status: "attention_required",
        mode: "off",
        nextAction: "resolve_conflict",
        checks: [
          {
            key: "provider",
            status: "blocked",
            labelKey: "aiAgentProduct.checks.providerUnsupported",
          },
          {
            key: "credential",
            status: "blocked",
            labelKey: "aiAgentProduct.checks.credentialIncompatible",
          },
          {
            key: "model",
            status: "blocked",
            labelKey: "aiAgentProduct.checks.modelIncompatible",
          },
        ],
      },
    });

    expect(mapped.status).toBe("attention_required");
    expect(mapped.ready).toBe(false);
    expect(mapped.nextAction.type).toBe("resolve_conflict");
    expect(mapped.checks.map((c) => c.key)).toEqual(
      expect.arrayContaining(["provider", "credential", "model"])
    );
  });

  it("credencial ausente → setup_incomplete sem activate", () => {
    const mapped = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "setup_incomplete",
      mode: "off",
      agent: { exists: true, id: 1, name: "Bot", enabled: false },
      connection: { linked: false },
      connectionScope: {
        type: "all_linked",
        count: 0,
        connectedCount: 0,
        disconnectedCount: 0,
        names: [],
      },
      agentScope: { type: "single", count: 1 },
      readiness: {
        ready: false,
        status: "setup_incomplete",
        mode: "off",
        nextAction: "configure_provider",
        checks: [
          {
            key: "credential",
            status: "pending",
            labelKey: "aiAgentProduct.checks.credential",
          },
        ],
      },
    });

    expect(mapped.status).toBe("setup_incomplete");
    const commands = buildAiAgentCommercialCommands(mapped);
    expect(
      commands.filter((c) =>
        ["activate_shadow", "activate_live"].includes(c.command)
      )
    ).toHaveLength(0);
  });

  it("modelo incompatível → attention_required bloqueia activate", () => {
    const mapped = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "attention_required",
      mode: "off",
      agent: { exists: true, id: 1, name: "Bot", enabled: false },
      connection: { linked: true, name: "WA", connected: true },
      connectionScope: {
        type: "all_linked",
        count: 1,
        connectedCount: 1,
        disconnectedCount: 0,
        names: ["WA"],
      },
      agentScope: { type: "single", count: 1 },
      readiness: {
        ready: false,
        status: "attention_required",
        mode: "off",
        nextAction: "resolve_conflict",
        checks: [
          {
            key: "model",
            status: "blocked",
            labelKey: "aiAgentProduct.checks.modelIncompatible",
          },
        ],
      },
    });

    const commands = buildAiAgentCommercialCommands(mapped);
    expect(commands.some((c) => c.command === "activate_shadow")).toBe(false);
    expect(mapAiAgentNextAction("resolve_conflict").type).toBe(
      "resolve_conflict"
    );
  });

  it("mapAiAgentCheck preserva labelKey do backend (sem recalcular)", () => {
    const check = mapAiAgentCheck({
      key: "credential",
      status: "blocked",
      labelKey: "aiAgentProduct.checks.credentialDisabled",
    });
    expect(check.labelKey).toBe("aiAgentProduct.checks.credentialDisabled");
    expect(check.status).toBe("blocked");
  });

  it("frontend não decide compatibilidade — só repassa status", () => {
    // Garante que o mapper não inspeciona provider/model/credentialRef
    const raw = {
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "ready_to_activate",
      mode: "off",
      agent: { exists: true, id: 1, name: "Bot", enabled: false },
      connection: { linked: true, name: "WA", connected: true },
      connectionScope: {
        type: "all_linked",
        count: 1,
        connectedCount: 1,
        disconnectedCount: 0,
        names: ["WA"],
      },
      agentScope: { type: "single", count: 1 },
      readiness: {
        ready: true,
        status: "ready_to_activate",
        mode: "off",
        nextAction: "activate_shadow",
        checks: [],
      },
    };
    const mapped = mapAiAgentProductSummary(raw);
    expect(mapped.ready).toBe(true);
    expect(mapped.status).toBe(raw.status);
  });
});
