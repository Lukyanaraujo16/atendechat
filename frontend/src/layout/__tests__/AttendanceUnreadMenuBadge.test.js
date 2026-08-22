/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import AttendanceUnreadMenuBadge from "../AttendanceUnreadMenuBadge";
import MainListItems from "../MainListItems";
import { AuthContext } from "../../context/Auth/AuthContext";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { SocketContext } from "../../context/Socket/SocketContext";
import { AttendanceUnreadContext } from "../../context/AttendanceUnread/AttendanceUnreadContext";

jest.mock("../../translate/i18n", () => ({
  i18n: {
    t: (key, opts) => {
      if (key === "mainDrawer.attendanceUnreadBadge") {
        return `${opts.count} conversas com mensagens não lidas`;
      }
      if (key === "mainDrawer.sections.atendimento") return "Atendimento";
      return key;
    },
  },
}));

jest.mock("../../hooks/usePlanFlags", () => ({
  __esModule: true,
  default: () => ({
    loaded: true,
    ready: true,
    useCampaigns: false,
    useKanban: false,
    useSchedules: false,
    effectiveFeatures: { "attendance.inbox": true },
  }),
}));

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: { records: [] } }) },
}));

jest.mock("../../utils/canUseAiAgent", () => ({ canUseAiAgent: () => false }));
jest.mock("../../utils/canManageAiAgentProduct", () => ({
  canAccessAiAgentProduct: () => false,
}));
jest.mock("../../utils/canUseKnowledgeBase", () => ({
  canUseKnowledgeBase: () => false,
}));
jest.mock("../../utils/agentOsConsoleAccess", () => ({
  canShowTechnicalConsoleNav: () => false,
}));
jest.mock("../../utils/canUseInventorySales", () => ({
  canUseInventorySales: () => false,
}));
jest.mock("../../utils/settingsConnectionsAccess", () => ({
  getConfiguracoesAccess: () => ({
    show: false,
    showConnections: false,
    defaultPath: "/settings",
  }),
}));
jest.mock("../../utils/attendanceAccess", () => {
  const actual = jest.requireActual("../../utils/attendanceAccess");
  return {
    ...actual,
    canAccessInternalChatModule: () => false,
    getAttendanceDefaultPath: () => "/tickets",
  };
});

const theme = createTheme();

function renderBadge(count) {
  return render(
    <ThemeProvider theme={theme}>
      <AttendanceUnreadMenuBadge count={count}>
        <span data-testid="icon">icon</span>
      </AttendanceUnreadMenuBadge>
    </ThemeProvider>
  );
}

describe("AttendanceUnreadMenuBadge", () => {
  it("0 → sem badge visível", () => {
    renderBadge(0);
    expect(
      screen.queryByLabelText(/conversas com mensagens não lidas/)
    ).toBeNull();
    const badge = document.querySelector(".MuiBadge-badge");
    expect(badge.className).toMatch(/MuiBadge-invisible/);
  });

  it("1 → badge 1", () => {
    renderBadge(1);
    expect(screen.getByLabelText("1 conversas com mensagens não lidas")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(document.querySelector(".MuiBadge-invisible")).toBeNull();
  });

  it("3 → badge 3", () => {
    renderBadge(3);
    expect(screen.getByLabelText("3 conversas com mensagens não lidas")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("99 → 99", () => {
    renderBadge(99);
    expect(screen.getByText("99")).toBeTruthy();
  });

  it("100 → 99+", () => {
    renderBadge(100);
    expect(screen.getByText("99+")).toBeTruthy();
    expect(screen.getByLabelText("100 conversas com mensagens não lidas")).toBeTruthy();
  });
});

function renderMenu({ count = 0, drawerClose = jest.fn() } = {}) {
  const socket = { on: jest.fn(), off: jest.fn() };
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user: {
              id: 7,
              companyId: 1,
              profile: "user",
              queues: [],
            },
          }}
        >
          <WhatsAppsContext.Provider value={{ whatsApps: [] }}>
            <SocketContext.Provider
              value={{ getSocket: () => socket }}
            >
              <AttendanceUnreadContext.Provider
                value={{ unreadConversationsCount: count }}
              >
                <MainListItems drawerClose={drawerClose} />
              </AttendanceUnreadContext.Provider>
            </SocketContext.Provider>
          </WhatsAppsContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("MainListItems — badge Atendimento", () => {
  it("renderiza o item Atendimento com badge no desktop/drawer compartilhado", () => {
    renderMenu({ count: 3 });
    expect(screen.getByText("Atendimento")).toBeTruthy();
    expect(
      screen.getByLabelText("3 conversas com mensagens não lidas")
    ).toBeTruthy();
  });

  it("drawer recolhido continua com badge no ícone (não no texto)", () => {
    renderMenu({ count: 2 });
    const badge = screen.getByLabelText("2 conversas com mensagens não lidas");
    expect(badge).toBeTruthy();
    expect(badge.querySelector("svg") || badge).toBeTruthy();
  });
});
