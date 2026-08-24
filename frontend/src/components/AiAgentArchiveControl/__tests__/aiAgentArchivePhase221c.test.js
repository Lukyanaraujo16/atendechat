/**
 * Fase 2.21C — Arquivamento seguro na UI Product.
 */
import React from "react";
import { Router, MemoryRouter } from "react-router-dom";
import { createMemoryHistory } from "history";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import fs from "fs";
import path from "path";
import AiAgentArchiveControl, {
  archiveNameMatches,
} from "..";
import { AiAgentSettingsPanel } from "../../AiAgentAdminPanels";
import { canManageAiAgentProduct } from "../../../utils/canManageAiAgentProduct";
import { postAiAgentProductArchive } from "../../../services/aiAgentProductApi";
import { AI_AGENT_ROUTE_PATH } from "../../../config/aiAgentFeature";
import { mapAiAgentProductSummary } from "../../../utils/aiAgentProductMapper";

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
    info: jest.fn(),
  },
}));

jest.mock("../../../services/aiAgentProductApi", () => ({
  postAiAgentProductArchive: jest.fn(),
  getAiAgentProductConfiguration: jest.fn(),
  getAiAgentProductConfigurationOptions: jest.fn(),
  putAiAgentProductConfiguration: jest.fn(),
  getAiAgentProductKnowledge: jest.fn(),
  putAiAgentProductKnowledge: jest.fn(),
}));

jest.mock("../../../utils/aiAgentProductAgentsCache", () => ({
  notifyAiAgentProductAgentsChanged: jest.fn(),
}));

const { toast } = require("react-toastify");

function renderArchive(props = {}) {
  const history = createMemoryHistory({
    initialEntries: ["/ai-agent/7/settings"],
  });
  const ui = (
    <Router history={history}>
      <AiAgentArchiveControl
        agentRef="7"
        agentName="Financeiro"
        enabled={false}
        canMutate
        {...props}
      />
    </Router>
  );
  return { history, ...render(ui) };
}

describe("Fase 2.21C — zona de perigo e permissões", () => {
  it("mostra zona de perigo e CTA para admin", () => {
    renderArchive();
    expect(screen.getByTestId("ai-agent-danger-zone")).toBeTruthy();
    expect(screen.getByTestId("ai-agent-archive-cta")).toBeTruthy();
    expect(screen.getByText("aiAgentProduct.archive.dangerTitle")).toBeTruthy();
    expect(screen.getByText("aiAgentProduct.archive.cardBody")).toBeTruthy();
  });

  it("esconde para user/supervisor", () => {
    renderArchive({ canMutate: false });
    expect(screen.queryByTestId("ai-agent-danger-zone")).toBeNull();
    expect(canManageAiAgentProduct({ profile: "user" })).toBe(false);
    expect(canManageAiAgentProduct({ profile: "supervisor" })).toBe(false);
  });

  it("supportMode com canMutate mostra a zona", () => {
    renderArchive({ canMutate: true });
    expect(screen.getByTestId("ai-agent-archive-cta")).toBeTruthy();
    expect(
      canManageAiAgentProduct({ super: true, supportMode: true })
    ).toBe(true);
  });

  it("Settings inclui a zona de perigo", () => {
    const summary = mapAiAgentProductSummary({
      availability: { enabledByPlan: true, accessibleByUser: true },
      status: "paused",
      mode: "live",
      agent: {
        exists: true,
        id: 7,
        agentRef: "7",
        name: "Financeiro",
        enabled: false,
      },
      readiness: {
        ready: false,
        status: "paused",
        mode: "live",
        nextAction: "none",
        checks: [],
      },
    });
    render(
      <MemoryRouter>
        <AiAgentSettingsPanel
          summary={summary}
          canMutate
          agentRef="7"
          onCommand={jest.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("ai-agent-danger-zone")).toBeTruthy();
  });
});

describe("Fase 2.21C — confirmação pelo nome", () => {
  it("nome precisa bater (trim, case-sensitive)", () => {
    expect(archiveNameMatches("Financeiro", "Financeiro")).toBe(true);
    expect(archiveNameMatches("  Financeiro  ", "Financeiro")).toBe(true);
    expect(archiveNameMatches("financeiro", "Financeiro")).toBe(false);
    expect(archiveNameMatches("Comercial", "Financeiro")).toBe(false);
  });

  it("botão de confirmar só habilita com o nome correto", () => {
    renderArchive();
    fireEvent.click(screen.getByTestId("ai-agent-archive-cta"));
    expect(screen.getByTestId("ai-agent-archive-confirm").disabled).toBe(true);
    fireEvent.change(screen.getByTestId("ai-agent-archive-name-input"), {
      target: { value: "Financeiro" },
    });
    expect(screen.getByTestId("ai-agent-archive-confirm").disabled).toBe(false);
  });

  it("cancelar não chama archive", () => {
    renderArchive();
    fireEvent.click(screen.getByTestId("ai-agent-archive-cta"));
    fireEvent.click(screen.getByText("confirmationModal.buttons.cancel"));
    expect(postAiAgentProductArchive).not.toHaveBeenCalled();
  });
});

describe("Fase 2.21C — agente ativo e sucesso", () => {
  it("ativo não abre o fluxo destrutivo final", () => {
    renderArchive({ enabled: true });
    fireEvent.click(screen.getByTestId("ai-agent-archive-cta"));
    expect(screen.queryByTestId("ai-agent-archive-name-input")).toBeNull();
    expect(
      screen.getByText("aiAgentProduct.archive.requiresDeactivation")
    ).toBeTruthy();
    expect(postAiAgentProductArchive).not.toHaveBeenCalled();
  });

  it("sucesso arquiva, redireciona Hub e o outro agente não é enviado", async () => {
    postAiAgentProductArchive.mockResolvedValue({ data: { archived: true } });
    const { history } = renderArchive();
    fireEvent.click(screen.getByTestId("ai-agent-archive-cta"));
    fireEvent.change(screen.getByTestId("ai-agent-archive-name-input"), {
      target: { value: "Financeiro" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ai-agent-archive-confirm"));
    });
    await waitFor(() => {
      expect(postAiAgentProductArchive).toHaveBeenCalledWith("7");
    });
    expect(postAiAgentProductArchive).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalled();
    expect(history.location.pathname).toBe(AI_AGENT_ROUTE_PATH);
  });

  it("erro não navega", async () => {
    postAiAgentProductArchive.mockRejectedValue({
      response: { status: 500, data: { error: "ERR_AI_AGENT_PRODUCT_COMMAND_NOT_ALLOWED" } },
    });
    const { history } = renderArchive();
    fireEvent.click(screen.getByTestId("ai-agent-archive-cta"));
    fireEvent.change(screen.getByTestId("ai-agent-archive-name-input"), {
      target: { value: "Financeiro" },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ai-agent-archive-confirm"));
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(history.location.pathname).toBe("/ai-agent/7/settings");
  });

  it("double-click dispara um único archive", async () => {
    let resolveArchive;
    postAiAgentProductArchive.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveArchive = resolve;
        })
    );
    renderArchive();
    fireEvent.click(screen.getByTestId("ai-agent-archive-cta"));
    fireEvent.change(screen.getByTestId("ai-agent-archive-name-input"), {
      target: { value: "Financeiro" },
    });
    const confirm = screen.getByTestId("ai-agent-archive-confirm");
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(postAiAgentProductArchive).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveArchive({ data: { archived: true } });
    });
  });

  it("CTA disabled durante commandBusy", () => {
    renderArchive({ commandBusy: "deactivate" });
    expect(screen.getByTestId("ai-agent-archive-cta").disabled).toBe(true);
  });
});

describe("Fase 2.21C — contrato frontend", () => {
  const controlSrc = fs.readFileSync(
    path.join(__dirname, "../index.js"),
    "utf8"
  );
  const apiSrc = fs.readFileSync(
    path.join(__dirname, "../../../services/aiAgentProductApi.js"),
    "utf8"
  );
  const detailSrc = fs.readFileSync(
    path.join(__dirname, "../../../pages/AiAgentDetail/index.js"),
    "utf8"
  );

  it("usa POST archive Product, não DELETE legado", () => {
    expect(apiSrc).toMatch(/agentScopedPath\(ref, "\/archive"\)/);
    expect(apiSrc).not.toMatch(/api\.delete\("\/ai-agents/);
    expect(controlSrc).not.toMatch(/Excluir permanentemente/);
  });

  it("Detail redireciona Hub com toast de arquivado", () => {
    expect(detailSrc).toMatch(/aiAgentProduct\.archive\.archivedToast/);
    expect(detailSrc).toMatch(/history\.replace\(AI_AGENT_ROUTE_PATH\)/);
  });
});

afterEach(() => {
  jest.clearAllMocks();
});
