/**
 * Fase 2.19 — Toggle de ativação rápida no card do AI Agent.
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
  rememberAiAgentLastOperationMode,
  takeAiAgentLastOperationMode,
  mapAiAgentProductCommandError,
  __resetAiAgentQuickToggleSessionMemory,
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
    </div>
  );
}

describe("Fase 2.19 — util quick toggle", () => {
  beforeEach(() => {
    __resetAiAgentQuickToggleSessionMemory();
  });

  it("resolve activate_shadow como padrão Product quando off", () => {
    expect(resolveAiAgentQuickActivateCommand({ operationMode: "off" })).toBe(
      "activate_shadow"
    );
  });

  it("preserva live/shadow quando modo ainda está no agent", () => {
    expect(resolveAiAgentQuickActivateCommand({ operationMode: "live" })).toBe(
      "activate_live"
    );
    expect(
      resolveAiAgentQuickActivateCommand({ operationMode: "shadow" })
    ).toBe("activate_shadow");
  });

  it("usa preferredMode da sessão após desativar", () => {
    rememberAiAgentLastOperationMode("ref-a", "live");
    expect(takeAiAgentLastOperationMode("ref-a")).toBe("live");
    expect(
      resolveAiAgentQuickActivateCommand({
        agentRef: "ref-a",
        operationMode: "off",
      })
    ).toBe("activate_live");
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

  it("supervisor conforme contrato (somente leitura)", () => {
    expect(canManageAiAgentProduct({ profile: "superv" })).toBe(false);
    expect(canManageAiAgentProduct({ profile: "supervisor" })).toBe(false);
  });
});

describe("Fase 2.19 — AiAgentCard toggle", () => {
  it("toggle aparece no card", () => {
    render(
      <AiAgentCard
        agent={agentFixture({ enabled: true })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(getToggle()).toBeTruthy();
  });

  it("ativo aparece ligado", () => {
    render(
      <AiAgentCard
        agent={agentFixture({ enabled: true })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(getToggle().checked).toBe(true);
  });

  it("desativado aparece desligado", () => {
    render(
      <AiAgentCard
        agent={agentFixture({ enabled: false })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(getToggle().checked).toBe(false);
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

  it("loading anuncia busy e desabilita", () => {
    render(
      <AiAgentCard
        agent={agentFixture({ enabled: true })}
        canMutate
        busy
        onToggleRequest={jest.fn()}
      />
    );
    expect(
      screen.getByTestId("ai-agent-card-toggle-loading-ref-a")
    ).toBeTruthy();
    expect(getToggle().disabled).toBe(true);
  });

  it("teclado no toggle não dispara Gerenciar agente", () => {
    const onManage = jest.fn();
    const onToggleRequest = jest.fn();
    render(
      <AiAgentCard
        agent={agentFixture({ enabled: false, ready: true })}
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

  it("Gerenciar agente é ação independente do toggle", () => {
    const onManage = jest.fn();
    const onToggleRequest = jest.fn();
    render(
      <AiAgentCard
        agent={agentFixture({ enabled: false })}
        canManage
        canMutate
        onManage={onManage}
        onToggleRequest={onToggleRequest}
      />
    );
    fireEvent.click(screen.getByTestId("ai-agent-card-manage-ref-a"));
    expect(onManage).toHaveBeenCalled();
    expect(onToggleRequest).not.toHaveBeenCalled();
  });

  it("expõe aria-label de ativar/desativar", () => {
    const { rerender } = render(
      <AiAgentCard
        agent={agentFixture({ enabled: false })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(
      screen.getAllByLabelText(
        "aiAgentProduct.hub.quickToggle.activateAria:Agente Comercial"
      ).length
    ).toBeGreaterThan(0);
    rerender(
      <AiAgentCard
        agent={agentFixture({ enabled: true })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(
      screen.getAllByLabelText(
        "aiAgentProduct.hub.quickToggle.deactivateAria:Agente Comercial"
      ).length
    ).toBeGreaterThan(0);
  });

  it("labels Ativo/Desativado visíveis", () => {
    const { rerender } = render(
      <AiAgentCard
        agent={agentFixture({ enabled: true })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(
      screen.getByText("aiAgentProduct.hub.quickToggle.activeLabel")
    ).toBeTruthy();
    rerender(
      <AiAgentCard
        agent={agentFixture({ enabled: false })}
        canMutate
        onToggleRequest={jest.fn()}
      />
    );
    expect(
      screen.getByText("aiAgentProduct.hub.quickToggle.inactiveLabel")
    ).toBeTruthy();
  });
});

describe("Fase 2.19 — hook quick toggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetAiAgentQuickToggleSessionMemory();
    postAiAgentProductCommand.mockResolvedValue({ data: { ok: true } });
  });

  it("ativação chama agentRef correto com activate_shadow", async () => {
    const onRetry = jest.fn().mockResolvedValue([]);
    const apiRef = { current: null };
    render(
      <QuickToggleHarness canMutate onRetry={onRetry} apiRef={apiRef} />
    );

    await act(async () => {
      apiRef.current.handleToggleRequest(
        agentFixture({ agentRef: "ref-fin", ready: true, enabled: false }),
        true
      );
    });

    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledWith(
        "activate_shadow",
        "ref-fin"
      );
    });
    expect(notifyAiAgentProductAgentsChanged).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "aiAgentProduct.hub.quickToggle.activated"
    );
    expect(onRetry).toHaveBeenCalled();
  });

  it("desativação pede confirmação e usa agentRef correto", async () => {
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
    expect(screen.getByTestId("deactivate-open").textContent).toBe("1");

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

  it("cancelar confirmação não executa command", () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);
    act(() => {
      apiRef.current.handleToggleRequest(agentFixture({ enabled: true }), false);
    });
    fireEvent.click(screen.getByText("cancel-deactivate"));
    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
    expect(screen.getByTestId("deactivate-open").textContent).toBe("0");
  });

  it("agente A não altera B", async () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    await act(async () => {
      apiRef.current.handleToggleRequest(
        agentFixture({
          agentRef: "ref-fin",
          name: "Financeiro",
          enabled: false,
          ready: true,
        }),
        true
      );
    });

    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledTimes(1);
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
        agentFixture({ ready: true, enabled: false }),
        true
      );
    });
    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({ ready: true, enabled: false }),
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

  it("readiness incompleto oferece CTA revisar configuração", () => {
    const onReview = jest.fn();
    const apiRef = { current: null };
    render(
      <QuickToggleHarness canMutate onReview={onReview} apiRef={apiRef} />
    );

    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({
          agentRef: "ref-a",
          ready: false,
          enabled: false,
          status: "setup_incomplete",
        }),
        true
      );
    });

    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
    expect(screen.getByTestId("not-ready-open").textContent).toBe("1");
    fireEvent.click(screen.getByText("review-config"));
    expect(onReview).toHaveBeenCalledWith(
      expect.objectContaining({ agentRef: "ref-a" })
    );
  });

  it("erro preserva estado e não marca sucesso", async () => {
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
        agentFixture({ ready: true, enabled: false }),
        true
      );
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("user sem canMutate não executa command", () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate={false} apiRef={apiRef} />);
    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({ ready: true }),
        true
      );
    });
    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
  });

  it("desativar live e reativar usa activate_live (memória de sessão)", async () => {
    const apiRef = { current: null };
    render(<QuickToggleHarness canMutate apiRef={apiRef} />);

    act(() => {
      apiRef.current.handleToggleRequest(
        agentFixture({
          agentRef: "ref-a",
          enabled: true,
          operationMode: "live",
          ready: true,
        }),
        false
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText("confirm-deactivate"));
    });
    await waitFor(() =>
      expect(postAiAgentProductCommand).toHaveBeenCalledWith(
        "deactivate",
        "ref-a"
      )
    );

    postAiAgentProductCommand.mockClear();

    await act(async () => {
      apiRef.current.handleToggleRequest(
        agentFixture({
          agentRef: "ref-a",
          enabled: false,
          operationMode: "off",
          ready: true,
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
        agentFixture({ ready: true, enabled: false }),
        true
      );
    });

    await waitFor(() => {
      expect(notifyAiAgentProductAgentsChanged).toHaveBeenCalled();
    });
  });
});

describe("Fase 2.19 — Hub renderiza toggle nos cards", () => {
  it("hub multiagente mostra toggles distintos", () => {
    const history = createMemoryHistory({ initialEntries: ["/ai-agent"] });
    render(
      <Router history={history}>
        <AiAgentHubPage
          loading={false}
          agents={[
            agentFixture({ agentRef: "ref-com", name: "Comercial", enabled: true }),
            agentFixture({
              agentRef: "ref-fin",
              name: "Financeiro",
              enabled: false,
            }),
          ]}
          canCreate
          canMutate
          onRetry={jest.fn()}
        />
      </Router>
    );
    expect(getToggle("ref-com").checked).toBe(true);
    expect(getToggle("ref-fin").checked).toBe(false);
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
