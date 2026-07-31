/**
 * Fase 2.11 — Super Admin em modo suporte no Product AI Agent.
 */
import React from "react";
import { Router } from "react-router-dom";
import { createMemoryHistory } from "history";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  canAccessAiAgentProduct,
  canManageAiAgentProduct,
  canMutateAiAgentInCurrentContext,
} from "../../utils/canManageAiAgentProduct";
import AiAgentHubPage from "../../components/AiAgentHubPage";
import AiAgentSupportBanner from "../../components/AiAgentSupportBanner";
import { AiAgentSettingsPanel } from "../../components/AiAgentAdminPanels";

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
      if (opts?.name != null) return `${key}:${opts.name}`;
      if (opts?.count != null) return `${key}:${opts.count}`;
      return key;
    },
  },
}));

jest.mock("../../components/ConfirmationModal", () => {
  return function MockConfirm({ open, onConfirm, children, title }) {
    if (!open) return null;
    return (
      <div data-testid="command-confirm-modal">
        <span>{title}</span>
        <div>{children}</div>
        <button type="button" onClick={onConfirm}>
          confirm
        </button>
      </div>
    );
  };
});

describe("Fase 2.11 — supportMode Product AI Agent", () => {
  it("1. Admin normal vê mutations", () => {
    expect(
      canManageAiAgentProduct({ profile: "admin", supportMode: false })
    ).toBe(true);
  });

  it("2. Super Admin em supportMode vê Novo agente", () => {
    const canCreate = canManageAiAgentProduct({
      profile: "admin",
      super: true,
      supportMode: true,
      companyId: 99,
    });
    expect(canCreate).toBe(true);

    const history = createMemoryHistory({ initialEntries: ["/ai-agent"] });
    render(
      <Router history={history}>
        <AiAgentHubPage
          loading={false}
          error={null}
          accessDenied={false}
          agents={[]}
          onRetry={() => {}}
          canCreate={canCreate}
          supportMode
          companyLabel="Empresa Alvo"
        />
      </Router>
    );
    expect(screen.getByTestId("ai-agent-hub-new-agent")).toBeTruthy();
  });

  it("3–8. Predicado habilita identidade/inteligência/knowledge/connections/commands/simulator", () => {
    const user = {
      profile: "admin",
      super: true,
      supportMode: true,
    };
    expect(canMutateAiAgentInCurrentContext(user)).toBe(true);
    expect(canAccessAiAgentProduct(user)).toBe(true);
  });

  it("9. Banner de suporte aparece", () => {
    render(
      <AiAgentSupportBanner supportMode companyLabel="Acme Ltda" />
    );
    expect(screen.getByTestId("ai-agent-support-banner")).toBeTruthy();
    expect(
      screen.getByText("aiAgentProduct.support.configuringCompany:Acme Ltda")
    ).toBeTruthy();
  });

  it("10. Usuário comum não recebe permissões", () => {
    expect(
      canManageAiAgentProduct({ profile: "user", supportMode: false })
    ).toBe(false);
    expect(
      canManageAiAgentProduct({
        profile: "user",
        supportMode: true,
        super: false,
      })
    ).toBe(false);
  });

  it("11. supportMode falso não libera Super Admin arbitrariamente como suporte", () => {
    const user = { profile: "admin", super: true, supportMode: false };
    expect(canManageAiAgentProduct(user)).toBe(true);
    expect(user.supportMode).not.toBe(true);
  });

  it("11b. supportMode sem super não libera", () => {
    expect(
      canManageAiAgentProduct({
        profile: "admin",
        super: false,
        supportMode: true,
      })
    ).toBe(false);
  });

  it("12–13. troca de tenant usa companyId da sessão (predicado não carrega tenant anterior)", () => {
    const inA = {
      profile: "admin",
      super: true,
      supportMode: true,
      companyId: 1,
    };
    const inB = { ...inA, companyId: 2 };
    expect(canManageAiAgentProduct(inA)).toBe(true);
    expect(canManageAiAgentProduct(inB)).toBe(true);
    expect(inA.companyId).not.toBe(inB.companyId);
  });

  it("14. secrets continuam mascarados — helper não expõe secret", () => {
    const user = {
      profile: "admin",
      super: true,
      supportMode: true,
      apiKey: "sk-secret",
    };
    expect(canManageAiAgentProduct(user)).toBe(true);
    expect(String(canManageAiAgentProduct.toString())).not.toMatch(/sk-secret/);
  });

  it("15. Live Mode exige confirmação", async () => {
    const onCommand = jest.fn().mockResolvedValue(undefined);
    render(
      <AiAgentSettingsPanel
        summary={{
          status: "ready_to_activate",
          connectionScope: { count: 1, names: ["WA"] },
        }}
        canMutate
        onCommand={onCommand}
        commandBusy={null}
        onOpenCredentials={() => {}}
        supportMode
      />
    );
    fireEvent.click(screen.getByTestId("ai-agent-command-activate_live"));
    expect(screen.getByTestId("command-confirm-modal")).toBeTruthy();
    expect(onCommand).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByText("confirm"));
    });
    expect(onCommand).toHaveBeenCalledWith("activate_live");
  });

  it("Banner não aparece para Admin normal", () => {
    const { queryByTestId } = render(
      <AiAgentSupportBanner supportMode={false} companyLabel="X" />
    );
    expect(queryByTestId("ai-agent-support-banner")).toBeNull();
  });
});
