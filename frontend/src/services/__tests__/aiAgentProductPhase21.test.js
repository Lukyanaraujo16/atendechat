/**
 * Fase 2.1 — Experience Layer do Agente de IA
 */
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AiAgentExperiencePage from "../../components/AiAgentExperiencePage";
import {
  AI_AGENT_PRODUCT_STATUSES,
  buildAiAgentSecondaryActions,
  isDeferredMutationAction,
  mapAiAgentNextAction,
  mapAiAgentProductSummary,
  normalizeAiAgentNextAction,
} from "../../utils/aiAgentProductMapper";
import { AI_AGENT_NEW_ROUTE_PATH } from "../../config/aiAgentFeature";
import {
  getAiAgentProductSummary,
  listAiAgentProductCredentials,
} from "../aiAgentProductApi";
import api from "../api";

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

jest.mock("../api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../aiAgentProductApi", () => {
  const actual = jest.requireActual("../aiAgentProductApi");
  return {
    ...actual,
    listAiAgentProductCredentials: jest.fn(() => Promise.resolve([])),
  };
});

jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key, opts) => {
      if (opts && opts.name) return `${key}:${opts.name}`;
      if (opts && opts.status) return `${key}:${opts.status}`;
      if (opts && opts.mode) return `${key}:${opts.mode}`;
      if (opts && opts.state) return `${key}:${opts.name || ""}:${opts.state}`;
      return key;
    },
  },
}));

jest.mock("../../components/AiAgentProductCredentialModal", () => ({
  __esModule: true,
  default: () => null,
}));

function summaryFor(status, overrides = {}) {
  return mapAiAgentProductSummary({
    availability: { enabledByPlan: true, accessibleByUser: true },
    status,
    mode: overrides.mode || "off",
    agent: overrides.agent || { exists: false },
    connection: overrides.connection || { linked: false },
    readiness: {
      ready: overrides.ready === true,
      status,
      mode: overrides.mode || "off",
      nextAction: overrides.nextAction || "none",
      checks: overrides.checks || [],
    },
  });
}

/** Aguarda o fetch de credentials do Hub estabilizar (evita warning act). */
async function renderExperience(ui, { expectCredentialsFetch = true } = {}) {
  listAiAgentProductCredentials.mockClear();
  listAiAgentProductCredentials.mockResolvedValue([]);
  const view = render(ui);
  if (expectCredentialsFetch) {
    await waitFor(() => {
      expect(listAiAgentProductCredentials).toHaveBeenCalled();
    });
  } else {
    await waitFor(() => {
      expect(listAiAgentProductCredentials).not.toHaveBeenCalled();
    });
  }
  return view;
}

describe("Fase 2.1 — mapper Experience", () => {
  it("cobre todos os status comerciais", () => {
    AI_AGENT_PRODUCT_STATUSES.forEach((status) => {
      const view = summaryFor(status);
      expect(view.status).toBe(status);
      expect(view.statusMeta.labelKey).toContain(status);
      expect(view.ready).toBe(false);
    });
  });

  it("não recalcula ready a partir dos checks", () => {
    const view = mapAiAgentProductSummary({
      status: "setup_incomplete",
      mode: "off",
      readiness: {
        ready: false,
        status: "setup_incomplete",
        nextAction: "configure_provider",
        checks: [
          { key: "plan", status: "complete", labelKey: "aiAgentProduct.checks.plan" },
          { key: "provider", status: "pending", labelKey: "aiAgentProduct.checks.provider" },
        ],
      },
      agent: { exists: true, id: 3, name: "A", enabled: true },
    });
    expect(view.ready).toBe(false);
    expect(view.checks).toHaveLength(2);
    expect(view.checks[0].key).toBe("plan");
  });

  it("create_agent aponta para o Wizard create (/ai-agent/new)", () => {
    const action = mapAiAgentNextAction("create_agent");
    expect(action.path).toBe(AI_AGENT_NEW_ROUTE_PATH);
    expect(action.enabled).toBe(true);
  });

  it("resume_agent permanece desabilitado; activate_* usa Product API (2.2)", () => {
    expect(isDeferredMutationAction("resume_agent")).toBe(true);
    const resume = mapAiAgentNextAction("resume_agent", { agentId: 9 });
    expect(resume.enabled).toBe(false);
    expect(resume.fallbackPath).toContain("/ai-agent/9/wizard");

    ["activate_shadow", "activate_live"].forEach((type) => {
      expect(isDeferredMutationAction(type)).toBe(false);
      const action = mapAiAgentNextAction(type, { agentId: 9 });
      expect(action.enabled).toBe(true);
      expect(action.command).toBe(type);
      expect(action.path).toBeNull();
    });
  });

  it("nextAction desconhecido → none seguro", () => {
    expect(normalizeAiAgentNextAction("explode")).toBe("none");
    expect(mapAiAgentNextAction("explode").type).toBe("none");
  });

  it("secondary inclui simulator na rota do agente (agentRef)", () => {
    const actions = buildAiAgentSecondaryActions({
      agent: { exists: true, id: 42, agentRef: "42" },
      agentScope: { type: "single", count: 1 },
    });
    expect(actions.some((a) => a.id === "open_simulator")).toBe(true);
    expect(actions.find((a) => a.id === "open_simulator").path).toBe(
      "/ai-agent/42/simulator"
    );
  });

  it("mode dry_run não aparece na UI — normaliza para off se inválido", () => {
    const view = mapAiAgentProductSummary({
      status: "active",
      mode: "dry_run",
      readiness: { ready: true, status: "active", nextAction: "none", checks: [] },
    });
    expect(view.mode).toBe("off");
  });
});

describe("Fase 2.1 — Experience page states", () => {
  beforeEach(() => {
    listAiAgentProductCredentials.mockClear();
    listAiAgentProductCredentials.mockResolvedValue([]);
  });

  it("loading mostra skeleton sem not_created", () => {
    render(
      <MemoryRouter>
        <AiAgentExperiencePage loading onRetry={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByLabelText("aiAgentProduct.loading.aria")).toBeTruthy();
    expect(screen.queryByTestId("ai-agent-status-card")).toBeNull();
    expect(listAiAgentProductCredentials).not.toHaveBeenCalled();
  });

  it("erro mostra retry", () => {
    const onRetry = jest.fn();
    render(
      <MemoryRouter>
        <AiAgentExperiencePage loading={false} error={{}} onRetry={onRetry} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText("aiAgentProduct.actions.retry"));
    expect(onRetry).toHaveBeenCalled();
    expect(listAiAgentProductCredentials).not.toHaveBeenCalled();
  });

  it("403 accessDenied sem summary", () => {
    render(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          accessDenied
          summary={summaryFor("active")}
          onRetry={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByText("aiAgentProduct.accessDenied.title")).toBeTruthy();
    expect(screen.queryByTestId("ai-agent-status-card")).toBeNull();
    expect(listAiAgentProductCredentials).not.toHaveBeenCalled();
  });

  it("unavailable não mostra checklist nem secondary", async () => {
    await renderExperience(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor("unavailable", {
            nextAction: "upgrade_plan",
            checks: [
              { key: "plan", status: "blocked", labelKey: "aiAgentProduct.checks.plan" },
            ],
          })}
          onRetry={() => {}}
        />
      </MemoryRouter>,
      { expectCredentialsFetch: false }
    );
    expect(screen.getByTestId("ai-agent-status-card")).toBeTruthy();
    expect(screen.queryByText("aiAgentProduct.checklist.title")).toBeNull();
    expect(listAiAgentProductCredentials).not.toHaveBeenCalled();
  });

  it("not_created com ação criar", async () => {
    await renderExperience(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor("not_created", { nextAction: "create_agent" })}
          onRetry={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-primary-action")).toBeTruthy();
  });

  it("ready_to_activate sem onCommand mantém botão seguro desabilitado", async () => {
    await renderExperience(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor("ready_to_activate", {
            ready: true,
            nextAction: "activate_shadow",
            agent: { exists: true, id: 7, name: "Bot", enabled: true },
            connection: { linked: true, name: "WA", connected: true },
            checks: [
              { key: "mode", status: "pending", labelKey: "aiAgentProduct.checks.mode" },
            ],
          })}
          onRetry={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-primary-action-disabled")).toBeTruthy();
  });

  it("ready_to_activate com onCommand habilita ação principal", async () => {
    await renderExperience(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor("ready_to_activate", {
            ready: true,
            nextAction: "activate_shadow",
            agent: { exists: true, id: 7, name: "Bot", enabled: true },
            connection: { linked: true, name: "WA", connected: true },
            checks: [],
          })}
          onRetry={() => {}}
          onCommand={jest.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-primary-action")).toBeTruthy();
  });

  it("active shadow mostra secondary simulator", async () => {
    await renderExperience(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor("active", {
            mode: "shadow",
            ready: true,
            nextAction: "none",
            agent: { exists: true, id: 5, name: "Bot", enabled: true },
            connection: { linked: true, name: "WA", connected: true },
          })}
          onRetry={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-secondary-open_simulator")).toBeTruthy();
  });

  it("attention_required renderiza card", async () => {
    await renderExperience(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor("attention_required", {
            mode: "live",
            nextAction: "fix_connection",
            agent: { exists: true, id: 1, name: "A", enabled: true },
            connection: { linked: true, name: "WA", connected: false },
            checks: [
              {
                key: "connection",
                status: "warning",
                labelKey: "aiAgentProduct.checks.connection",
              },
            ],
          })}
          onRetry={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-status-card")).toBeTruthy();
    expect(screen.getByText("aiAgentProduct.checklist.title")).toBeTruthy();
  });

  it("paused renderiza com segurança", async () => {
    await renderExperience(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor("paused", {
            mode: "paused",
            nextAction: "resume_agent",
            agent: { exists: true, id: 2, name: "P", enabled: false },
          })}
          onRetry={() => {}}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-status-card")).toBeTruthy();
  });
});

describe("Fase 2.1 — Product API only", () => {
  it("service não chama /automation", async () => {
    api.get.mockClear();
    api.get.mockResolvedValue({ data: {} });
    await getAiAgentProductSummary();
    expect(api.get.mock.calls[0][0]).toBe("/product/ai-agent/summary");
    expect(api.get.mock.calls[0][0]).not.toMatch(/automation/);
  });
});
