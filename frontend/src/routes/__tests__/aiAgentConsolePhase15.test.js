/**
 * Fase 1.5 — shell, navegação e contratos do Console Técnico.
 */
import React from "react";
import { MemoryRouter, Route } from "react-router-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";

import TechnicalAgentOsRoutes from "../TechnicalAgentOsRoutes";
import { AuthContext } from "../../context/Auth/AuthContext";
import { i18n } from "../../translate/i18n";
import {
  AGENTOS_TECHNICAL_ROUTE_ENTRIES,
  TECHNICAL_CONSOLE_ROOT_PATH,
  getAgentOsRouterPaths,
} from "../../config/agentOsConsoleRoutes";
import {
  AGENTOS_CONSOLE_NAV_GROUPS,
  AGENTOS_CONSOLE_NAV_ITEMS,
  getCommercialPathsExcludedFromConsole,
  getNavItemByPath,
  listCanonicalNavPaths,
} from "../../config/agentOsConsoleNavigation";
import {
  canManageAgentOsRollout,
  canManageAgentOsProduction,
  hasPlatformPermission,
  AGENTOS_PLATFORM_PERMISSION_KEYS,
} from "../../config/agentOsPlatformPermissions";
import { canShowTechnicalConsoleNav } from "../../utils/agentOsConsoleAccess";
import { resetTechnicalConsoleAccessCache } from "../../services/technicalConsoleAccessProbe";
import {
  AI_AGENT_ANALYTICS_ROUTE_PATH,
  AI_AGENT_SHADOW_FC_ROUTE_PATH,
  AUTOMATION_MONITOR_ROUTE_PATH,
} from "../../config/aiAgentFeature";

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

jest.mock("@material-ui/core/useMediaQuery", () => jest.fn());

jest.mock("../../pages/AutomationMonitor", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => React.createElement("div", { "data-testid": "page-monitor" }),
  };
});
jest.mock("../../pages/AutomationObservability", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-observability" }),
  };
});
jest.mock("../../pages/AutomationPlanning", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-planning" }),
  };
});
jest.mock("../../pages/AutomationPlanEvaluation", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-evaluation" }),
  };
});
jest.mock("../../pages/AutomationExecutionSessions", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", {
        "data-testid": "page-execution-sessions",
      }),
  };
});
jest.mock("../../pages/AutomationRuntimeIntegration", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-runtime" }),
  };
});
jest.mock("../../pages/AutomationActionExecution", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-actions" }),
  };
});
jest.mock("../../pages/AutomationExecutionFeedback", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-feedback" }),
  };
});
jest.mock("../../pages/AutomationCognitiveMemory", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-memory" }),
  };
});
jest.mock("../../pages/AutomationMcpRuntime", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () => React.createElement("div", { "data-testid": "page-mcp" }),
  };
});
jest.mock("../../pages/AutomationLearningEngine", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-learning" }),
  };
});
jest.mock("../../pages/AutomationMultiAgent", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-multi-agent" }),
  };
});
jest.mock("../../pages/AutomationEvidence", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-evidence" }),
  };
});
jest.mock("../../pages/AutomationLiveRollout", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-rollout" }),
  };
});
jest.mock("../../pages/AutomationProduction", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-production" }),
  };
});
jest.mock("../../pages/AutomationTools", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-tools" }),
  };
});
jest.mock("../../pages/AiAgentAnalytics", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-analytics" }),
  };
});
jest.mock("../../pages/AiAgentShadowFc", () => {
  const React = require("react");
  return {
    __esModule: true,
    default: () =>
      React.createElement("div", { "data-testid": "page-shadow-fc" }),
  };
});

const api = require("../../services/api").default;

const theme = createTheme();

function authUser(overrides = {}) {
  return {
    id: 50,
    isInternalUser: true,
    companyId: 7,
    company: { name: "Acme Ops" },
    supportMode: false,
    platformPermissions: ["agentOS.console.view"],
    ...overrides,
  };
}

function renderConsole(user, initialPath = TECHNICAL_CONSOLE_ROOT_PATH) {
  api.get.mockResolvedValue({
    data: { allowed: true, reason: "ok", permissionKey: "agentOS.console.view" },
  });
  return render(
    <ThemeProvider theme={theme}>
      <AuthContext.Provider value={{ user, loading: false }}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Route path={getAgentOsRouterPaths()} component={TechnicalAgentOsRoutes} />
        </MemoryRouter>
      </AuthContext.Provider>
    </ThemeProvider>
  );
}

describe("Fase 1.5 — configuração de navegação", () => {
  it("IDs e paths canônicos são únicos", () => {
    const ids = AGENTOS_CONSOLE_NAV_ITEMS.map((i) => i.id);
    const paths = AGENTOS_CONSOLE_NAV_ITEMS.map((i) => i.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("todos os pageKeys da matriz estão na navegação", () => {
    const navKeys = new Set(AGENTOS_CONSOLE_NAV_ITEMS.map((i) => i.pageKey));
    AGENTOS_TECHNICAL_ROUTE_ENTRIES.forEach((e) => {
      expect(navKeys.has(e.pageKey)).toBe(true);
      expect(e.canonicalPath.startsWith(TECHNICAL_CONSOLE_ROOT_PATH)).toBe(true);
      expect(e.canonicalPath).not.toBe(e.legacyPath);
    });
    expect(AGENTOS_CONSOLE_NAV_ITEMS.length).toBe(
      AGENTOS_TECHNICAL_ROUTE_ENTRIES.length
    );
  });

  it("nenhuma rota comercial como path principal", () => {
    const commercial = getCommercialPathsExcludedFromConsole();
    listCanonicalNavPaths().forEach((p) => {
      expect(commercial.includes(p)).toBe(false);
      expect(p.startsWith("/automation/")).toBe(false);
      expect(p === "/ai-agent/analytics").toBe(false);
    });
  });

  it("aliases não são paths principais", () => {
    AGENTOS_CONSOLE_NAV_ITEMS.forEach((item) => {
      expect(item.path).toBe(
        AGENTOS_TECHNICAL_ROUTE_ENTRIES.find((e) => e.pageKey === item.pageKey)
          .canonicalPath
      );
      expect(item.legacyPaths[0]).not.toBe(item.path);
    });
  });

  it("traduções existem para grupos e itens", () => {
    AGENTOS_CONSOLE_NAV_GROUPS.forEach((g) => {
      const t = i18n.t(g.labelKey);
      expect(t).toBeTruthy();
      expect(t).not.toBe(g.labelKey);
    });
    AGENTOS_CONSOLE_NAV_ITEMS.forEach((item) => {
      const t = i18n.t(item.labelKey);
      expect(t).toBeTruthy();
      expect(t).not.toBe(item.labelKey);
    });
  });

  it("grupos cobrem todos os itens", () => {
    const groupIds = new Set(AGENTOS_CONSOLE_NAV_GROUPS.map((g) => g.id));
    AGENTOS_CONSOLE_NAV_ITEMS.forEach((item) => {
      expect(groupIds.has(item.group)).toBe(true);
    });
  });
});

describe("Fase 1.5 — shell", () => {
  beforeEach(() => {
    resetTechnicalConsoleAccessCache();
    api.get.mockReset();
    useMediaQuery.mockReturnValue(false);
  });

  it("usuário autorizado renderiza shell e landing", async () => {
    renderConsole(authUser());
    expect(await screen.findByTestId("agentos-console-layout")).toBeTruthy();
    expect(screen.getByTestId("technical-console-landing")).toBeTruthy();
    expect(screen.getByTestId("agentos-console-nav")).toBeTruthy();
  });

  it("landing mostra empresa ativa e grupos", async () => {
    renderConsole(authUser());
    await screen.findByTestId("technical-console-landing");
    expect(screen.getAllByText(/Acme Ops/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("landing-link-monitor")).toBeTruthy();
    expect(screen.getByTestId("agentos-nav-group-operation")).toBeTruthy();
  });

  it("rota de módulo ativa item e breadcrumb", async () => {
    renderConsole(
      authUser(),
      `${TECHNICAL_CONSOLE_ROOT_PATH}/monitor`
    );
    await screen.findByTestId("agentos-console-layout");
    const item = screen.getByTestId("agentos-nav-item-monitor");
    expect(item.getAttribute("aria-selected") || item.className).toBeTruthy();
    expect(item.className.includes("listItemSelected") || item.className.includes("Mui-selected")).toBe(
      true
    );
    const crumb = screen.getByTestId("agentos-console-breadcrumb");
    expect(crumb.textContent).toMatch(/Monitor/i);
    expect(getNavItemByPath(`${TECHNICAL_CONSOLE_ROOT_PATH}/monitor`).group).toBe(
      "operation"
    );
    expect(await screen.findByTestId("page-monitor")).toBeTruthy();
  });

  it("rota desconhecida mostra 404 interna", async () => {
    renderConsole(authUser(), `${TECHNICAL_CONSOLE_ROOT_PATH}/nao-existe`);
    expect(await screen.findByTestId("agentos-console-not-found")).toBeTruthy();
  });

  it("supportMode exibe contexto de suporte", async () => {
    renderConsole(authUser({ supportMode: true }));
    expect(await screen.findByTestId("agentos-support-context")).toBeTruthy();
  });
});

describe("Fase 1.5 — menu principal (sessão)", () => {
  it("apenas condição interna+view; supportMode não libera", () => {
    expect(
      canShowTechnicalConsoleNav({
        isInternalUser: false,
        supportMode: true,
        platformPermissions: ["agentOS.console.view"],
      })
    ).toBe(false);
    expect(
      canShowTechnicalConsoleNav({
        isInternalUser: true,
        platformPermissions: [],
      })
    ).toBe(false);
    expect(
      canShowTechnicalConsoleNav({
        isInternalUser: true,
        supportMode: true,
        platformPermissions: ["agentOS.console.view"],
      })
    ).toBe(true);
  });
});

describe("Fase 1.5 — mobile", () => {
  beforeEach(() => {
    resetTechnicalConsoleAccessCache();
    api.get.mockReset();
    useMediaQuery.mockReturnValue(true);
  });

  it("usa menu recolhível sem sidebar fixa larga", async () => {
    renderConsole(authUser());
    await screen.findByTestId("agentos-console-layout");
    expect(screen.getByTestId("agentos-console-mobile-menu")).toBeTruthy();
    expect(screen.queryByTestId("agentos-console-nav")).toBeNull();
    fireEvent.click(screen.getByTestId("agentos-console-mobile-menu"));
    expect(await screen.findByTestId("agentos-console-nav")).toBeTruthy();
    fireEvent.click(screen.getByTestId("agentos-nav-home"));
    await waitFor(() => {
      const drawer = screen.queryByTestId("agentos-console-mobile-drawer");
      expect(
        !drawer || drawer.getAttribute("aria-hidden") === "true"
      ).toBe(true);
    });
  });
});

describe("Fase 1.5 — permissões de escrita (helpers)", () => {
  it("view não implica rollout/production manage", () => {
    const user = authUser();
    expect(canManageAgentOsRollout(user)).toBe(false);
    expect(canManageAgentOsProduction(user)).toBe(false);
    expect(
      hasPlatformPermission(user, AGENTOS_PLATFORM_PERMISSION_KEYS.CONSOLE_VIEW)
    ).toBe(true);
  });

  it("grant específico habilita escrita", () => {
    const user = authUser({
      platformPermissions: [
        "agentOS.console.view",
        "agentOS.rollout.manage",
        "agentOS.production.manage",
      ],
    });
    expect(canManageAgentOsRollout(user)).toBe(true);
    expect(canManageAgentOsProduction(user)).toBe(true);
  });
});

describe("Fase 1.5 — aliases", () => {
  beforeEach(() => {
    resetTechnicalConsoleAccessCache();
    api.get.mockReset();
    useMediaQuery.mockReturnValue(false);
  });

  it("alias monitor preserva query e hash", async () => {
    api.get.mockResolvedValue({
      data: { allowed: true, reason: "ok", permissionKey: "agentOS.console.view" },
    });
    render(
      <ThemeProvider theme={theme}>
        <AuthContext.Provider value={{ user: authUser(), loading: false }}>
          <MemoryRouter
            initialEntries={[`${AUTOMATION_MONITOR_ROUTE_PATH}?companyId=1#health`]}
          >
            <Route path={getAgentOsRouterPaths()} component={TechnicalAgentOsRoutes} />
          </MemoryRouter>
        </AuthContext.Provider>
      </ThemeProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId("agentos-console-layout")).toBeTruthy();
    });
    expect(screen.getByTestId("agentos-nav-item-monitor")).toBeTruthy();
    expect(await screen.findByTestId("page-monitor")).toBeTruthy();
  });

  it("aliases analytics e shadow-fc existem na matriz", () => {
    const analytics = AGENTOS_TECHNICAL_ROUTE_ENTRIES.find(
      (e) => e.pageKey === "analytics"
    );
    const shadow = AGENTOS_TECHNICAL_ROUTE_ENTRIES.find(
      (e) => e.pageKey === "shadow-fc"
    );
    expect(analytics.legacyPath).toBe(AI_AGENT_ANALYTICS_ROUTE_PATH);
    expect(shadow.legacyPath).toBe(AI_AGENT_SHADOW_FC_ROUTE_PATH);
  });
});

describe("Fase 1.5 — rotas comerciais fora do shell", () => {
  it("paths comerciais não estão no namespace técnico", () => {
    getCommercialPathsExcludedFromConsole().forEach((p) => {
      expect(listCanonicalNavPaths().includes(p)).toBe(false);
      expect(p.startsWith(TECHNICAL_CONSOLE_ROOT_PATH)).toBe(false);
    });
    expect(getNavItemByPath("/ai-agent")).toBeNull();
    expect(getNavItemByPath("/flowbuilders")).toBeNull();
  });
});
