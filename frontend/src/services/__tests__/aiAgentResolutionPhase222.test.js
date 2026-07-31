/**
 * Hardening 2.2.2 — resolução segura do agente comercial (Experience)
 * Atualizado 2.9B: ambiguous não bloqueia UI como falha; aponta ao Hub.
 */
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import AiAgentExperiencePage from "../../components/AiAgentExperiencePage";
import {
  buildAiAgentCommercialCommands,
  buildAiAgentSecondaryActions,
  mapAiAgentProductSummary,
} from "../../utils/aiAgentProductMapper";
import { AI_AGENT_ROUTE_PATH } from "../../config/aiAgentFeature";
import { listAiAgentProductCredentials } from "../aiAgentProductApi";

// jsdom antigo do CRA 3 não expõe MutationObserver (necessário para waitFor).
if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

jest.mock("../../translate/i18n", () => ({
  i18n: { t: (key, opts) => (opts?.count != null ? `${key}:${opts.count}` : key) },
}));

jest.mock("../aiAgentProductApi", () => {
  const actual = jest.requireActual("../aiAgentProductApi");
  return {
    ...actual,
    listAiAgentProductCredentials: jest.fn(() => Promise.resolve([])),
  };
});

jest.mock("../../components/AiAgentProductCredentialModal", () => ({
  __esModule: true,
  default: () => null,
}));

describe("aiAgentResolutionPhase222", () => {
  it("agentScope.none", () => {
    const view = mapAiAgentProductSummary({
      status: "not_created",
      mode: "off",
      agentScope: { type: "none", count: 0 },
      agent: { exists: false },
      readiness: {
        ready: false,
        status: "not_created",
        nextAction: "create_agent",
        checks: [],
      },
    });
    expect(view.agentScope).toEqual({ type: "none", count: 0 });
  });

  it("agentScope.single preserva id comercial", () => {
    const view = mapAiAgentProductSummary({
      status: "ready_to_activate",
      mode: "off",
      agentScope: { type: "single", count: 1 },
      agent: { exists: true, id: 7, name: "Bot", enabled: false },
      connectionScope: {
        type: "all_linked",
        count: 1,
        connectedCount: 1,
        disconnectedCount: 0,
        names: ["WA"],
      },
      readiness: {
        ready: true,
        status: "ready_to_activate",
        nextAction: "activate_shadow",
        checks: [],
      },
    });
    expect(view.agentScope.type).toBe("single");
    expect(view.agent.id).toBe(7);
    expect(view.commercialCommands.length).toBeGreaterThan(0);
  });

  it("agentScope.ambiguous: sem activate/deactivate; secundárias vão ao Hub", async () => {
    const view = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "attention_required",
      mode: "off",
      agentScope: { type: "ambiguous", count: 2 },
      agent: { exists: true },
      readiness: {
        ready: false,
        status: "attention_required",
        mode: "off",
        nextAction: "configure_agent",
        checks: [
          {
            key: "agent",
            status: "blocked",
            labelKey: "aiAgentProduct.checks.agentAmbiguous",
          },
        ],
      },
    });
    expect(view.agentScope.type).toBe("ambiguous");
    expect(buildAiAgentCommercialCommands(view)).toHaveLength(0);
    const secondary = buildAiAgentSecondaryActions(view);
    expect(secondary.find((a) => a.id === "edit_intelligence")?.path).toBe(
      AI_AGENT_ROUTE_PATH
    );
    expect(secondary.find((a) => a.id === "open_simulator")?.path).toBe(
      AI_AGENT_ROUTE_PATH
    );

    render(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={view}
          onRetry={() => {}}
          onCommand={jest.fn()}
        />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(listAiAgentProductCredentials).toHaveBeenCalled();
    });
    // 2.9B: múltiplos agentes não são erro de produto na Experience.
    expect(screen.queryByTestId("ai-agent-ambiguous-notice")).toBeNull();
    expect(screen.queryByTestId("ai-agent-command-activate_live")).toBeNull();
    expect(screen.queryByTestId("ai-agent-command-deactivate")).toBeNull();
    expect(screen.queryByTestId("ai-agent-primary-action")).toBeTruthy();
  });

  it("fallback type desconhecido → none seguro", () => {
    const view = mapAiAgentProductSummary({
      agentScope: { type: "explode", count: 9 },
      status: "unavailable",
      readiness: { ready: false, status: "unavailable", nextAction: "upgrade_plan", checks: [] },
    });
    expect(view.agentScope.type).toBe("none");
  });

  it("frontend não inventa agente principal a partir de lista", () => {
    const view = mapAiAgentProductSummary({
      agentScope: { type: "ambiguous", count: 3 },
      agent: { exists: true, id: 99, name: "ShouldIgnore" },
      status: "attention_required",
      readiness: {
        ready: false,
        status: "attention_required",
        nextAction: "configure_agent",
        checks: [],
      },
    });
    const secondary = buildAiAgentSecondaryActions(view);
    expect(secondary.find((a) => a.id === "edit_intelligence")?.path).toBe(
      AI_AGENT_ROUTE_PATH
    );
  });
});
