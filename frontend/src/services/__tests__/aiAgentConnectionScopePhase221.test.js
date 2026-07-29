/**
 * Hardening 2.2.1 — escopo de conexões na Experience Layer
 */
import {
  getAiAgentCommandConfirmParams,
  mapAiAgentProductSummary,
} from "../../utils/aiAgentProductMapper";

describe("aiAgentConnectionScopePhase221", () => {
  it("mapper preserva connectionScope comercial", () => {
    const view = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "ready_to_activate",
      mode: "off",
      agent: { exists: true, id: 1, name: "Bot", enabled: false },
      connection: { linked: true, name: "A", connected: true },
      connectionScope: {
        type: "all_linked",
        count: 2,
        connectedCount: 1,
        disconnectedCount: 1,
        names: ["A", "B"],
      },
      readiness: {
        ready: true,
        status: "ready_to_activate",
        mode: "off",
        nextAction: "activate_shadow",
        checks: [],
      },
    });
    expect(view.connectionScope).toEqual({
      type: "all_linked",
      count: 2,
      connectedCount: 1,
      disconnectedCount: 1,
      names: ["A", "B"],
    });
  });

  it("confirmação interpola count e names", () => {
    const params = getAiAgentCommandConfirmParams({
      count: 3,
      names: ["X", "Y", "Z"],
      disconnectedCount: 1,
      connectedCount: 2,
    });
    expect(params.count).toBe(3);
    expect(params.names).toBe("X, Y, Z");
    expect(params.disconnectedCount).toBe(1);
  });

  it("attention_required por modo misto oferece comandos de normalização", () => {
    const view = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "attention_required",
      mode: "live",
      agent: { exists: true, id: 1, name: "Bot", enabled: true },
      connection: { linked: true, name: "A", connected: true },
      agentScope: { type: "single", count: 1 },
      connectionScope: {
        type: "all_linked",
        count: 2,
        connectedCount: 2,
        disconnectedCount: 0,
        names: ["A", "B"],
      },
      readiness: {
        ready: false,
        status: "attention_required",
        mode: "live",
        nextAction: "resolve_conflict",
        checks: [],
      },
    });
    const cmds = view.commercialCommands.map((c) => c.command);
    expect(cmds).toEqual(
      expect.arrayContaining(["activate_shadow", "activate_live", "deactivate"])
    );
  });

  it("não inventa ids técnicos no scope mapeado", () => {
    const view = mapAiAgentProductSummary({
      connectionScope: {
        type: "all_linked",
        count: 1,
        connectedCount: 1,
        disconnectedCount: 0,
        names: ["WA"],
        whatsappId: 99,
        companyId: 1,
      },
      readiness: { ready: false, status: "unavailable", nextAction: "upgrade_plan", checks: [] },
      status: "unavailable",
      mode: "off",
    });
    expect(view.connectionScope).not.toHaveProperty("whatsappId");
    expect(view.connectionScope).not.toHaveProperty("companyId");
  });
});
