/**
 * Fase 2.21B — Reconfigurar agente pelo wizard existente.
 */
import React from "react";
import { Router, MemoryRouter } from "react-router-dom";
import { createMemoryHistory } from "history";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import fs from "fs";
import path from "path";
import AiAgentReconfigureControl from "..";
import AiAgentExperiencePage from "../../AiAgentExperiencePage";
import {
  canShowAiAgentReconfigure,
  isAiAgentStructurallyLocked,
} from "../../../hooks/useAiAgentReconfigure";
import { canManageAiAgentProduct } from "../../../utils/canManageAiAgentProduct";
import { mapAiAgentProductSummary } from "../../../utils/aiAgentProductMapper";
import { aiAgentWizardEditPath } from "../../../config/aiAgentFeature";
import { postAiAgentProductCommand } from "../../../services/aiAgentProductApi";
import { notifyAiAgentProductAgentsChanged } from "../../../utils/aiAgentProductAgentsCache";
import { resolveAiAgentQuickActivateCommand } from "../../../utils/aiAgentQuickToggle";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

jest.mock("../../../translate/i18n", () => ({
  i18n: {
    t: (key, opts) => {
      if (opts && opts.name != null) return `${key}:${opts.name}`;
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

jest.mock("../../../services/aiAgentProductApi", () => ({
  postAiAgentProductCommand: jest.fn(),
  listAiAgentProductCredentials: jest.fn(() => Promise.resolve([])),
}));

jest.mock("../../../utils/aiAgentProductAgentsCache", () => ({
  notifyAiAgentProductAgentsChanged: jest.fn(),
}));

const { toast } = require("react-toastify");

function summaryFor(overrides = {}) {
  return mapAiAgentProductSummary({
    availability: { enabledByPlan: true, accessibleByUser: true },
    status: overrides.status || "ready_to_activate",
    mode: overrides.mode || "off",
    agent: overrides.agent || {
      exists: true,
      id: 42,
      agentRef: "42",
      name: "Financeiro",
      enabled: false,
    },
    connection: overrides.connection || {
      linked: true,
      name: "WA",
      connected: true,
    },
    readiness: {
      ready: overrides.ready !== false,
      status: overrides.status || "ready_to_activate",
      mode: overrides.mode || "off",
      nextAction: overrides.nextAction || "none",
      checks: overrides.checks || [],
    },
  });
}

function renderControl({
  history,
  agentRef = "42",
  summary = summaryFor(),
  canMutate = true,
  commandBusy = null,
  onRetry,
} = {}) {
  const mem = history || createMemoryHistory({ initialEntries: ["/ai-agent/42"] });
  const ui = (
    <Router history={mem}>
      <AiAgentReconfigureControl
        agentRef={agentRef}
        summary={summary}
        canMutate={canMutate}
        commandBusy={commandBusy}
        onRetry={onRetry}
      />
    </Router>
  );
  return { history: mem, ...render(ui) };
}

describe("Fase 2.21B — permissões Product", () => {
  it("admin do tenant pode gerenciar", () => {
    expect(canManageAiAgentProduct({ profile: "admin" })).toBe(true);
  });

  it("Super Admin em supportMode pode gerenciar", () => {
    expect(
      canManageAiAgentProduct({ super: true, supportMode: true, profile: "admin" })
    ).toBe(true);
  });

  it("user e supervisor não podem gerenciar", () => {
    expect(canManageAiAgentProduct({ profile: "user" })).toBe(false);
    expect(canManageAiAgentProduct({ profile: "supervisor" })).toBe(false);
  });
});

describe("Fase 2.21B — visibilidade do CTA", () => {
  it("mostra CTA na visão geral quando canMutate e agentRef existem", () => {
    renderControl();
    expect(screen.getByTestId("ai-agent-reconfigure-cta")).toBeTruthy();
  });

  it("esconde CTA para user/supervisor (canMutate false)", () => {
    renderControl({ canMutate: false });
    expect(screen.queryByTestId("ai-agent-reconfigure-cta")).toBeNull();
  });

  it("esconde CTA sem agentRef", () => {
    expect(
      canShowAiAgentReconfigure({
        canMutate: true,
        agentRef: "",
        summary: summaryFor(),
      })
    ).toBe(false);
  });

  it("ExperiencePage com agentRef renderiza o CTA", async () => {
    render(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor()}
          agentRef="42"
          canMutate
          onRetry={() => {}}
        />
      </MemoryRouter>
    );
    expect(await screen.findByTestId("ai-agent-reconfigure-cta")).toBeTruthy();
  });

  it("supportMode com canMutate mostra CTA", async () => {
    render(
      <MemoryRouter>
        <AiAgentExperiencePage
          loading={false}
          summary={summaryFor()}
          agentRef="42"
          canMutate
          supportMode
          onRetry={() => {}}
        />
      </MemoryRouter>
    );
    expect(await screen.findByTestId("ai-agent-reconfigure-cta")).toBeTruthy();
  });
});

describe("Fase 2.21B — agente desativado abre wizard", () => {
  it("navega para o wizard do agentRef correto sem deactivate", () => {
    const history = createMemoryHistory({ initialEntries: ["/ai-agent/42"] });
    renderControl({
      history,
      summary: summaryFor({
        status: "paused",
        mode: "live",
        agent: {
          exists: true,
          id: 42,
          agentRef: "42",
          name: "Financeiro",
          enabled: false,
        },
      }),
    });
    fireEvent.click(screen.getByTestId("ai-agent-reconfigure-cta"));
    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
    expect(history.location.pathname).toBe(aiAgentWizardEditPath("42"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Fase 2.21B — agente ativo exige confirmação", () => {
  const liveSummary = summaryFor({
    status: "active",
    mode: "live",
    agent: {
      exists: true,
      id: 42,
      agentRef: "42",
      name: "Financeiro",
      enabled: true,
    },
  });
  const shadowSummary = summaryFor({
    status: "active",
    mode: "shadow",
    agent: {
      exists: true,
      id: 42,
      agentRef: "42",
      name: "Financeiro",
      enabled: true,
    },
  });

  it("Live mostra modal e não navega ainda", () => {
    const history = createMemoryHistory({ initialEntries: ["/ai-agent/42"] });
    renderControl({ history, summary: liveSummary });
    expect(isAiAgentStructurallyLocked(liveSummary)).toBe(true);
    fireEvent.click(screen.getByTestId("ai-agent-reconfigure-cta"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByText("aiAgentProduct.reconfigure.confirmTitle:Financeiro")
    ).toBeTruthy();
    expect(history.location.pathname).toBe("/ai-agent/42");
    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
  });

  it("Shadow mostra a mesma confirmação", () => {
    renderControl({ summary: shadowSummary });
    fireEvent.click(screen.getByTestId("ai-agent-reconfigure-cta"));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(
      screen.getByText("aiAgentProduct.reconfigure.confirmBodyDeactivate")
    ).toBeTruthy();
  });

  it("cancelar não altera o agente", () => {
    const history = createMemoryHistory({ initialEntries: ["/ai-agent/42"] });
    renderControl({ history, summary: liveSummary });
    fireEvent.click(screen.getByTestId("ai-agent-reconfigure-cta"));
    fireEvent.click(screen.getByText("confirmationModal.buttons.cancel"));
    expect(postAiAgentProductCommand).not.toHaveBeenCalled();
    expect(history.location.pathname).toBe("/ai-agent/42");
  });

  it("confirmar chama deactivate e navega para o agentRef correto", async () => {
    postAiAgentProductCommand.mockResolvedValue({ data: { summary: {} } });
    const onRetry = jest.fn().mockResolvedValue();
    const history = createMemoryHistory({ initialEntries: ["/ai-agent/42"] });
    renderControl({ history, summary: liveSummary, onRetry });
    fireEvent.click(screen.getByTestId("ai-agent-reconfigure-cta"));
    await act(async () => {
      fireEvent.click(
        screen.getByText("aiAgentProduct.reconfigure.confirmAction")
      );
    });
    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledWith("deactivate", "42");
    });
    expect(postAiAgentProductCommand).toHaveBeenCalledTimes(1);
    expect(notifyAiAgentProductAgentsChanged).toHaveBeenCalled();
    expect(onRetry).toHaveBeenCalled();
    expect(history.location.pathname).toBe(aiAgentWizardEditPath("42"));
    expect(toast.success).toHaveBeenCalled();
  });

  it("falha ao desativar não navega e mostra toast", async () => {
    postAiAgentProductCommand.mockRejectedValue({
      response: { status: 403, data: { error: "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED" } },
    });
    const history = createMemoryHistory({ initialEntries: ["/ai-agent/42"] });
    renderControl({ history, summary: liveSummary });
    fireEvent.click(screen.getByTestId("ai-agent-reconfigure-cta"));
    await act(async () => {
      fireEvent.click(
        screen.getByText("aiAgentProduct.reconfigure.confirmAction")
      );
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(history.location.pathname).toBe("/ai-agent/42");
    expect(notifyAiAgentProductAgentsChanged).not.toHaveBeenCalled();
  });

  it("double-click no confirm dispara um único deactivate", async () => {
    let resolveCommand;
    postAiAgentProductCommand.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCommand = resolve;
        })
    );
    const history = createMemoryHistory({ initialEntries: ["/ai-agent/42"] });
    renderControl({ history, summary: liveSummary });
    fireEvent.click(screen.getByTestId("ai-agent-reconfigure-cta"));
    const confirm = screen.getByText("aiAgentProduct.reconfigure.confirmAction");
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(postAiAgentProductCommand).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCommand({ data: {} });
    });
    await waitFor(() => {
      expect(history.location.pathname).toBe(aiAgentWizardEditPath("42"));
    });
  });

  it("CTA fica disabled durante commandBusy do pai", () => {
    renderControl({ summary: liveSummary, commandBusy: "deactivate" });
    expect(screen.getByTestId("ai-agent-reconfigure-cta").disabled).toBe(true);
  });
});

describe("Fase 2.21B — multiagente e modo anterior", () => {
  it("Financeiro não navega para o wizard do Comercial", async () => {
    postAiAgentProductCommand.mockResolvedValue({ data: {} });
    const history = createMemoryHistory({
      initialEntries: ["/ai-agent/financeiro"],
    });
    renderControl({
      history,
      agentRef: "financeiro",
      summary: summaryFor({
        status: "active",
        mode: "shadow",
        agent: {
          exists: true,
          id: 7,
          agentRef: "financeiro",
          name: "Financeiro",
          enabled: true,
        },
      }),
    });
    fireEvent.click(screen.getByTestId("ai-agent-reconfigure-cta"));
    await act(async () => {
      fireEvent.click(
        screen.getByText("aiAgentProduct.reconfigure.confirmAction")
      );
    });
    await waitFor(() => {
      expect(postAiAgentProductCommand).toHaveBeenCalledWith(
        "deactivate",
        "financeiro"
      );
    });
    expect(history.location.pathname).toBe(aiAgentWizardEditPath("financeiro"));
    expect(history.location.pathname).not.toContain("comercial");
  });

  it("quick toggle reativa Live após Live e Shadow após Shadow", () => {
    expect(resolveAiAgentQuickActivateCommand({ operationMode: "live" })).toBe(
      "activate_live"
    );
    expect(
      resolveAiAgentQuickActivateCommand({ operationMode: "shadow" })
    ).toBe("activate_shadow");
    expect(resolveAiAgentQuickActivateCommand({ operationMode: "off" })).toBe(
      null
    );
  });
});

describe("Fase 2.21B — wizard existente (save final, mesmo agente)", () => {
  const wizardSrc = fs.readFileSync(
    path.join(__dirname, "../../AiAgentWizard/index.js"),
    "utf8"
  );
  const commandSrc = fs.readFileSync(
    path.join(
      __dirname,
      "../../../../../backend/src/services/AiAgentProductService/ExecuteAiAgentProductCommandService.ts"
    ),
    "utf8"
  );

  it("edit usa update do agente atual, não create", () => {
    expect(wizardSrc).toMatch(/else if \(isEditMode\) \{/);
    expect(wizardSrc).toMatch(/result = await update\(/);
    expect(wizardSrc).toMatch(/result = await create\(/);
    expect(wizardSrc).toMatch(/initialAgentRef/);
  });

  it("wizard não reativa automaticamente no save", () => {
    expect(wizardSrc).not.toMatch(/activate_live|activate_shadow/);
  });

  it("deactivate Product preserva aiAgentMode", () => {
    expect(commandSrc).toMatch(/Preserva aiAgentMode/);
    expect(commandSrc).toMatch(/aiAgentEnabled: false/);
  });
});

afterEach(() => {
  jest.clearAllMocks();
});
