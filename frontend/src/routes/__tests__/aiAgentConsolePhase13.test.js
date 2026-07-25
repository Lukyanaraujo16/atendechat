/**
 * Fase 1.3 — AgentOsRouteGuard, probe e contratos de rota.
 */
import React from "react";
import { MemoryRouter, Route } from "react-router-dom";
import { render, screen, waitFor, act } from "@testing-library/react";
import AgentOsRouteGuard from "../../components/AgentOsRouteGuard";
import { AuthContext } from "../../context/Auth/AuthContext";
import {
  probeTechnicalConsoleAccess,
  resetTechnicalConsoleAccessCache,
} from "../../services/technicalConsoleAccessProbe";
import {
  AGENTOS_TECHNICAL_ROUTE_ENTRIES,
  TECHNICAL_CONSOLE_ROOT_PATH,
  getAgentOsRouterPaths,
  isAgentOsTechnicalPath,
} from "../../config/agentOsConsoleRoutes";
import {
  canShowTechnicalConsoleNav,
  hasSerializedAgentOsConsoleAccess,
} from "../../utils/agentOsConsoleAccess";
import { isCommercialAutomationsPath } from "../../utils/commercialAutomationsNav";
import {
  AI_AGENT_ROUTE_PATH,
  AI_AGENT_WIZARD_ROUTE_PATH,
  AI_AGENT_SIMULATOR_ROUTE_PATH,
  AUTOMATION_MONITOR_ROUTE_PATH,
  AUTOMATION_MCP_RUNTIME_ROUTE_PATH,
  AUTOMATION_PRODUCTION_ROUTE_PATH,
} from "../../config/aiAgentFeature";
import { KNOWLEDGE_BASE_ROUTE_PATH } from "../../config/knowledgeBaseFeature";

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

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

const api = require("../../services/api").default;

function renderGuard(user, authLoading = false, { path = "/x", search = "" } = {}) {
  return render(
    <AuthContext.Provider value={{ user, loading: authLoading }}>
      <MemoryRouter initialEntries={[`${path}${search}`]}>
        <Route
          path={path}
          render={() => (
            <AgentOsRouteGuard>
              <div data-testid="technical-content">SECRET_TECH</div>
            </AgentOsRouteGuard>
          )}
        />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

function renderLegacyRedirect(user, legacyPath, canonicalPath, search = "") {
  return render(
    <AuthContext.Provider value={{ user, loading: false }}>
      <MemoryRouter initialEntries={[`${legacyPath}${search}`]}>
        <Route
          path={legacyPath}
          render={() => (
            <AgentOsRouteGuard redirectToCanonical={canonicalPath} />
          )}
        />
        <Route
          path={canonicalPath}
          render={({ location }) => (
            <div data-testid="canonical-landed">
              {location.pathname}
              {location.search}
            </div>
          )}
        />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe("Fase 1.3 — acesso serializado / menu", () => {
  it("admin tenant não vê Console mesmo com supportMode", () => {
    expect(
      canShowTechnicalConsoleNav({
        id: 1,
        isInternalUser: false,
        supportMode: true,
        platformPermissions: ["agentOS.console.view"],
      })
    ).toBe(false);
  });

  it("interno sem permission não vê", () => {
    expect(
      canShowTechnicalConsoleNav({
        id: 2,
        isInternalUser: true,
        platformPermissions: [],
      })
    ).toBe(false);
  });

  it("interno com permission vê; supportMode não altera", () => {
    const base = {
      id: 3,
      isInternalUser: true,
      platformPermissions: ["agentOS.console.view"],
    };
    expect(canShowTechnicalConsoleNav({ ...base, supportMode: false })).toBe(
      true
    );
    expect(canShowTechnicalConsoleNav({ ...base, supportMode: true })).toBe(
      true
    );
  });
});

describe("Fase 1.3 — AgentOsRouteGuard", () => {
  beforeEach(() => {
    resetTechnicalConsoleAccessCache();
    api.get.mockReset();
  });

  it("admin tenant com features implícitas → negado sem probe liberando conteúdo", async () => {
    api.get.mockResolvedValue({ data: { allowed: true } });
    renderGuard({
      id: 10,
      isInternalUser: false,
      profile: "admin",
      platformPermissions: [],
    });
    expect(screen.queryByTestId("technical-content")).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId("agentos-console-denied")).toBeTruthy();
    });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("admin tenant em supportMode → negado", async () => {
    renderGuard({
      id: 11,
      isInternalUser: false,
      supportMode: true,
      platformPermissions: [],
    });
    await waitFor(() => {
      expect(screen.getByTestId("agentos-console-denied")).toBeTruthy();
    });
    expect(screen.queryByTestId("technical-content")).toBeNull();
  });

  it("interno sem permission → negado", async () => {
    renderGuard({
      id: 12,
      isInternalUser: true,
      platformPermissions: [],
    });
    await waitFor(() => {
      expect(screen.getByTestId("agentos-console-denied")).toBeTruthy();
    });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("interno com permission serializada, probe 403 → negado", async () => {
    api.get.mockRejectedValue({ response: { status: 403 } });
    renderGuard({
      id: 13,
      isInternalUser: true,
      platformPermissions: ["agentOS.console.view"],
    });
    await waitFor(() => {
      expect(screen.getByTestId("agentos-console-denied")).toBeTruthy();
    });
    expect(screen.queryByTestId("technical-content")).toBeNull();
    expect(api.get).toHaveBeenCalledWith("/technical-console/access");
  });

  it("interno com permission e probe 200 → permitido", async () => {
    api.get.mockResolvedValue({
      data: { allowed: true, isInternalUser: true, permissions: ["agentOS.console.view"] },
    });
    renderGuard({
      id: 14,
      isInternalUser: true,
      platformPermissions: ["agentOS.console.view"],
    });
    expect(screen.getByTestId("agentos-console-loading")).toBeTruthy();
    expect(screen.queryByTestId("technical-content")).toBeNull();
    await waitFor(() => {
      expect(screen.getByTestId("technical-content")).toBeTruthy();
    });
    expect(screen.getByText("SECRET_TECH")).toBeTruthy();
  });

  it("interno em supportMode com permission → permitido", async () => {
    api.get.mockResolvedValue({ data: { allowed: true } });
    renderGuard({
      id: 15,
      isInternalUser: true,
      supportMode: true,
      platformPermissions: ["agentOS.console.view"],
    });
    await waitFor(() => {
      expect(screen.getByTestId("technical-content")).toBeTruthy();
    });
  });

  it("falha de rede → negado (deny closed)", async () => {
    api.get.mockRejectedValue(new Error("network"));
    renderGuard({
      id: 16,
      isInternalUser: true,
      platformPermissions: ["agentOS.console.view"],
    });
    await waitFor(() => {
      expect(screen.getByTestId("agentos-console-denied")).toBeTruthy();
    });
    expect(screen.queryByTestId("technical-content")).toBeNull();
  });

  it("loading de auth não renderiza conteúdo técnico", () => {
    renderGuard(
      {
        id: 17,
        isInternalUser: true,
        platformPermissions: ["agentOS.console.view"],
      },
      true
    );
    expect(screen.getByTestId("agentos-console-loading")).toBeTruthy();
    expect(screen.queryByTestId("technical-content")).toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe("Fase 1.3 — aliases e query string", () => {
  beforeEach(() => {
    resetTechnicalConsoleAccessCache();
    api.get.mockReset();
    api.get.mockResolvedValue({ data: { allowed: true } });
  });

  it.each([
    [AUTOMATION_MONITOR_ROUTE_PATH, `${TECHNICAL_CONSOLE_ROOT_PATH}/monitor`],
    [
      AUTOMATION_MCP_RUNTIME_ROUTE_PATH,
      `${TECHNICAL_CONSOLE_ROOT_PATH}/mcp`,
    ],
    [
      AUTOMATION_PRODUCTION_ROUTE_PATH,
      `${TECHNICAL_CONSOLE_ROOT_PATH}/production`,
    ],
  ])("alias %s redireciona para %s preservando query", async (legacy, canonical) => {
    renderLegacyRedirect(
      {
        id: 20,
        isInternalUser: true,
        platformPermissions: ["agentOS.console.view"],
      },
      legacy,
      canonical,
      "?executionId=99&tab=traces"
    );
    await waitFor(() => {
      expect(screen.getByTestId("canonical-landed").textContent).toBe(
        `${canonical}?executionId=99&tab=traces`
      );
    });
  });

  it("admin cliente bloqueado em alias antigo", async () => {
    renderLegacyRedirect(
      { id: 21, isInternalUser: false, platformPermissions: [] },
      AUTOMATION_MONITOR_ROUTE_PATH,
      `${TECHNICAL_CONSOLE_ROOT_PATH}/monitor`,
      "?companyId=1"
    );
    await waitFor(() => {
      expect(screen.getByTestId("agentos-console-denied")).toBeTruthy();
    });
    expect(screen.queryByTestId("canonical-landed")).toBeNull();
  });
});

describe("Fase 1.3 — contratos de rota", () => {
  it("rotas canônicas novas estão no router paths", () => {
    const paths = getAgentOsRouterPaths();
    expect(paths).toContain(TECHNICAL_CONSOLE_ROOT_PATH);
    expect(paths).toContain(`${TECHNICAL_CONSOLE_ROOT_PATH}/monitor`);
    expect(paths).toContain(`${TECHNICAL_CONSOLE_ROOT_PATH}/mcp`);
    expect(paths).toContain(AUTOMATION_MONITOR_ROUTE_PATH);
  });

  it("classifica paths técnicos", () => {
    expect(isAgentOsTechnicalPath("/automation/monitor")).toBe(true);
    expect(isAgentOsTechnicalPath(`${TECHNICAL_CONSOLE_ROOT_PATH}/mcp`)).toBe(
      true
    );
    expect(isAgentOsTechnicalPath("/flowbuilders")).toBe(false);
    expect(isAgentOsTechnicalPath(AI_AGENT_ROUTE_PATH)).toBe(false);
  });

  it("rotas comerciais não são AgentOS technical", () => {
    const commercial = [
      "/flowbuilders",
      "/phrase-lists",
      "/queue-integration",
      AI_AGENT_ROUTE_PATH,
      AI_AGENT_WIZARD_ROUTE_PATH,
      AI_AGENT_SIMULATOR_ROUTE_PATH.replace(":agentId", "12"),
      KNOWLEDGE_BASE_ROUTE_PATH,
      "/quick-messages",
      "/prompts",
    ];
    commercial.forEach((p) => {
      expect(isAgentOsTechnicalPath(p)).toBe(false);
    });
    expect(isCommercialAutomationsPath("/flowbuilders")).toBe(true);
  });

  it("matriz de entradas cobre aliases sem inventar módulos", () => {
    expect(AGENTOS_TECHNICAL_ROUTE_ENTRIES.length).toBeGreaterThanOrEqual(16);
    AGENTOS_TECHNICAL_ROUTE_ENTRIES.forEach((e) => {
      expect(e.canonicalPath.startsWith(TECHNICAL_CONSOLE_ROOT_PATH)).toBe(
        true
      );
      expect(e.legacyPath).toBeTruthy();
      expect(e.pageKey).toBeTruthy();
    });
  });
});

describe("Fase 1.3 — probe compartilhado", () => {
  beforeEach(() => {
    resetTechnicalConsoleAccessCache();
    api.get.mockReset();
  });

  it("uma chamada por userId (promise compartilhada)", async () => {
    let resolveGet;
    api.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        })
    );

    const p1 = probeTechnicalConsoleAccess(42);
    const p2 = probeTechnicalConsoleAccess(42);
    expect(api.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveGet({ data: { allowed: true } });
    });

    const [a, b] = await Promise.all([p1, p2]);
    expect(a.state).toBe("allowed");
    expect(b.state).toBe("allowed");
    expect(api.get).toHaveBeenCalledTimes(1);

    const p3 = await probeTechnicalConsoleAccess(42);
    expect(p3.state).toBe("allowed");
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe("Fase 1.3 — hasSerializedAgentOsConsoleAccess", () => {
  it("exige interno e grant", () => {
    expect(
      hasSerializedAgentOsConsoleAccess({
        isInternalUser: true,
        platformPermissions: ["agentOS.console.view"],
      })
    ).toBe(true);
    expect(
      hasSerializedAgentOsConsoleAccess({
        isInternalUser: true,
        platformPermissions: ["agentOS.console.manage"],
      })
    ).toBe(false);
  });
});
