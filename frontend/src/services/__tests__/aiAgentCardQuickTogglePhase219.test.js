/**
 * Fase 2.19.1 — Persistência do modo operacional (backend authority).
 * Toggle rápido no card; sem memória SPA.
 */
import React from "react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import AiAgentCard from "../../components/AiAgentCard";
import AiAgentHubPage from "../../components/AiAgentHubPage";
import useAiAgentHubQuickToggle from "../../hooks/useAiAgentHubQuickToggle";
import {
  resolveAiAgentQuickActivateCommand,
  resolveAiAgentPersistedOperationMode,
  mapAiAgentProductCommandError,
} from "../../utils/aiAgentQuickToggle";
import { canManageAiAgentProduct } from "../../utils/canManageAiAgentProduct";
import { postAiAgentProductCommand } from "../aiAgentProductApi";
import { notifyAiAgentProductAgentsChanged } from "../../utils/aiAgentProductAgentsCache";
import { aiAgentWizardEditPath } from "../../config/aiAgentFeature";

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
  i18n: {
    t: (key, opts) => {
      if (opts?.count != null) return `${key}:${opts.count}`;
      if (opts?.name != null) return `${key}:${opts.name}`;
      if (opts?.mode != null) return `${key}:${opts.mode}`;
      return key;
    },
  },
}));

jest.mock("react-toastify", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("../aiAgentProductApi", () => ({
  postAiAgentProductCommand: jest.fn(),
}));

jest.mock("../../utils/aiAgentProductAgentsCache", () => ({
  notifyAiAgentProductAgentsChanged: jest.fn(),
}));

const { toast } = require("react-toastify");

function agentFixture(overrides = {}) {
  return {
    agentRef: "ref-a",
    name: "Agente Comercial",
    enabled: false,
    provider: "openai",
    model: "gpt-4o-mini",
    operationMode: "off",
    status: "ready_to_activate",
    ready: true,
    connectionCount: 2,
    ...overrides,
  };
}

function getToggle(agentRef = "ref-a") {
  return screen.getByTestId(`ai-agent-card-toggle-${agentRef}`);
}

function flipToggle(agentRef = "ref-a") {
  fireEvent.keyDown(screen.getByTestId(`ai-agent-card-toggle-wrap-${agentRef}`), {
    key: "Enter",
  });
}

function QuickToggleHarness({ canMutate = true, onRetry, onReview, apiRef }) {
  const api = useAiAgentHubQuickToggle({ canMutate, onRetry, onReview });
  if (apiRef) {
    apiRef.current = api;
  }
  return (
    <div>
      <span data-testid="busy">{api.busyAgentRef || ""}</span>
      <span data-testid="deactivate-open">
        {api.deactivateTarget ? "1" : "0"}
      </span>
      <span data-testid="not-ready-open">{api.notReadyTarget ? "1" : "0"}</span>
      <span data-testid="mode-choice-open">
        {api.modeChoiceTarget ? "1" : "0"}
      </span>
      {api.deactivateTarget ? (
        <button type="button" onClick={api.confirmDeactivate}>
          confirm-deactivate
        </button>
      ) : null}
      {api.deactivateTarget ? (
        <button type="button" onClick={api.cancelDeactivate}>
          cancel-deactivate
        </button>
      ) : null}
      {api.notReadyTarget ? (
        <button type="button" onClick={api.confirmNotReadyReview}>
          review-config
        </button>
      ) : null}
      {api.modeChoiceTarget ? (
        <>
          <button
            type="button"
            onClick={() => api.confirmModeChoice("activate_shadow")}
          >
            choose-shadow
          </button>
          <button
            type="button"
            onClick={() => api.confirmModeChoice("activate_live")}
          >
            choose-live
          </button>
        </>
      ) : null}
    </div>
  );
}

describe("Fase 2.19.1 — util quick toggle (modo persistido)", () => {
  it("Live desativado resolve activate_live", () => {
    expect(
      resolveAiAgentQuickActivateCommand({ operationMode: "live" })
    ).toBe("activate_live");
  });

  it("Shadow desativado resolve activate_shadow", () => {
    expect(
      resolveAiAgentQuickActivateCommand({ operationMode: "shadow" })
    ).toBe("activate_shadow");
  });

  it("modo off não escolhe Shadow silenciosamente", () => {
    expect(resolveAiAgentQuickActivateCommand({ operationMode: "off" })).toBe(
      null
    );
  });

  it("persisted mode ignora off", () => {
    expect(resolveAiAgentPersistedOperationMode({ operationMode: "live" })).toBe(
      "live"
    );
    expect(resolveAiAgentPersistedOperationMode({ operationMode: "off" })).toBe(
      null
    );
  });

  it("mapeia erro de readiness para mensagem comercial", () => {
    const message = mapAiAgentProductCommandError({
      response: { data: { error: "ERR_AI_AGENT_PRODUCT_NOT_READY" } },
    });
    expect(message).toBe("aiAgentProduct.hub.quickToggle.notReadyBody");
  });
});

describe("Fase 2.19 — permissões", () => {
  it("admin pode mutar", () => {
    expect(canManageAiAgentProduct({ profile: "admin", super: false })).toBe(
      true
    );
  });

  it("supportMode com Super Admin pode mutar", () => {
    expect(
      canManageAiAgentProduct({
        profile: "admin",
        super: true,
        supportMode: true,
      })
    ).toBe(true);
  });

  it("user sem permissão não pode", () => {
    expect(canManageAiAgentProduct({ profile: "user" })).toBe(false);
  });
});

describe("Fase 2.19 — AiAgentCard toggle", () => {
  it("toggle aparece e reflete enabled", () => {
    const { rerender } = render(
      <AiAgentCard
        agent={agentFixture({ enabled: true, operationMode: "live" })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(getToggle().checked).toBe(true);
    rerender(
      <AiAgentCard
        agent={agentFixture({ enabled: false, operationMode: "live" })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(getToggle().checked).toBe(false);
    expect(screen.getByTestId("ai-agent-card-last-mode-ref-a")).toBeTruthy();
  });

  it("sem permissão fica disabled", () => {
    render(
      <AiAgentCard
        agent={agentFixture()}
        canMutate={false}
        onToggleRequest={jest.fn()}
      />
    );
    expect(getToggle().disabled).toBe(true);
  });

  it("teclado no toggle não dispara Gerenciar agente", () => {
    const onManage = jest.fn();
    const onToggleRequest = jest.fn();
    render(
      <AiAgentCard
        agent={agentFixture({ enabled: false, ready: true, operationMode: "live" })}
        canManage
        canMutate
        onManage={onManage}
        onToggleRequest={onToggleRequest}
      />
    );
    flipToggle("ref-a");
    expect(onToggleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ agentRef: "ref-a" }),
      true
    );
    expect(onManage).not.toHaveBeenCalled();
  });
});

describe("Fase 2.19.1 — hook quick toggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    postAiAgentProductCommand.mockResolvedValue({ data: { ok: true } });
  });

  it("card Live desativado reativa com activate_live", async () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    await act(async () => {
      apiRef.current.handleToggleRequest(
        agentFixture({
          agentRef: "ref-a",
          ready: true,
          enabled: false,
          operationMode: "live",
        }),
        true
      );
    });

    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledWith(
        "activate_live",
        "ref-a"
      );
    });
  });

  it("card Shadow desativado reativa com activate_shadow", async () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    await act(async () => {
      apiRef.current.handleToggleRequest(
        agentFixture({
          agentRef: "ref-fin",
          ready: true,
          enabled: false,
          operationMode: "shadow",
        }),
        true
      );
    });

    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledWith(
        "activate_shadow",
        "ref-fin"
      );
    });
  });

  it("sem memória SPA: modo off abre escolha explícita", async () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({ ready: true, enabled: false, operationMode: "off" }),
        true
      );
    });

    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
    expect(screen.getByTestId("mode-choice-open").textContent).toBe("1");

    await act(async () => {
      fireEvent.click(screen.getByText("choose-live"));
    });

    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledWith(
        "activate_live",
        "ref-a"
      );
    });
  });

  it("desativação pede confirmação e usa agentRef", async () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({
          agentRef: "ref-a",
          enabled: true,
          operationMode: "live",
        }),
        false
      );
    });

    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByText("confirm-deactivate"));
    });
    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledWith(
        "deactivate",
        "ref-a"
      );
    });
  });

  it("agente A não altera B", async () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    await act(async () => {
      apiRef.current.handleToggleRequest(
        agentFixture({
          agentRef: "ref-fin",
          enabled: false,
          ready: true,
          operationMode: "shadow",
        }),
        true
      );
    });

    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledWith(
        "activate_shadow",
        "ref-fin"
      );
    });
  });

  it("duplo clique bloqueado enquanto busy", async () => {
    let resolveCmd;
    postAiAgentProductCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCmd = resolve;
        })
    );
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({ ready: true, enabled: false, operationMode: "live" }),
        true
      );
    });
    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({ ready: true, enabled: false, operationMode: "live" }),
        true
      );
    });

    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveCmd({ data: {} });
    });
  });

  it("erro não marca sucesso", async () => {
    postAiAgentProductCommand.mockRejectedValue({
      response: {
        status: 409,
        data: { error: "ERR_AI_AGENT_PRODUCT_NOT_READY" },
      },
    });
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    await act(async () => {
      apiRef.current.handleToggleRequest(
        agentFixture({ ready: true, enabled: false, operationMode: "live" }),
        true
      );
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("cache é invalidado após sucesso", async () => {
    const apiRef = { current: null };
    render(
      <QuickToggleHarness
        canMutate
        onRetry={jest.fn().mockResolvedValue([])}
        apiRef={apiRef}
      />
    );

    await act(async () => {
      apiRef.current.handleToggleRequest(
        agentFixture({ ready: true, enabled: false, operationMode: "shadow" }),
        true
      );
    });

    await waitFor(() => {
      expect(notifyAiAgentProductAgentsChanged).toHaveBeenCalled();
    });
  });

  it("user sem canMutate não executa command", () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate={false} apiRef={apiRef} />);
    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({ ready: true, operationMode: "live" }),
        true
      );
    });
    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
  });
});

describe("Fase 2.19 — Hub renderiza toggle nos cards", () => {
  it("hub multiagente mostra toggles e último modo", () => {
    const history = createMemoryHistory({ initialEntries: ["/ai-agent"] });
    render(
      <Router history={history}>
        <AiAgentHubPage
          loading={false}
          agents={[
            agentFixture({
              agentRef: "ref-com",
              name: "Comercial",
              enabled: false,
              operationMode: "live",
              ready: true,
            }),
            agentFixture({
              agentRef: "ref-fin",
              name: "Financeiro",
              enabled: false,
              operationMode: "shadow",
              ready: true,
            }),
          ]}
          canCreate
          canMutate
          onRetry={jest.fn()}
        />
      </Router>
    );
    expect(getToggle("ref-com").checked).toBe(false);
    expect(getToggle("ref-fin").checked).toBe(false);
    expect(screen.getByTestId("ai-agent-card-last-mode-ref-com")).toBeTruthy();
    expect(screen.getByTestId("ai-agent-card-last-mode-ref-fin")).toBeTruthy();
  });

  it("hub readiness incompleto via teclado abre CTA", () => {
    const history = createMemoryHistory({ initialEntries: ["/ai-agent"] });
    render(
      <Router history={history}>
        <AiAgentHubPage
          loading={false}
          agents={[
            agentFixture({
              agentRef: "ref-a",
              ready: false,
              enabled: false,
              status: "setup_incomplete",
            }),
          ]}
          canCreate
          canMutate
          onRetry={jest.fn()}
        />
      </Router>
    );
    flipToggle("ref-a");
    expect(
      screen.getByText("aiAgentProduct.hub.quickToggle.notReadyBody")
    ).toBeTruthy();
    const reviewButtons = screen.getAllByText("aiAgentProduct.hub.reviewConfig");
    fireEvent.click(reviewButtons[reviewButtons.length - 1]);
    expect(history.location.pathname).toBe(aiAgentWizardEditPath("ref-a"));
  });
});
