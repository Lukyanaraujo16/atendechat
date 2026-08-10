/**
 * @jest-environment jsdom
 *
 * Focus mode + menu compacto (breakpoint alinhado a down("md")).
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";
import fs from "fs";
import path from "path";

import ModuleTabsLayout from "../../layout/ModuleTabsLayout";
import TicketConversationActionBar from "../../components/TicketConversationActionBar";
import { MOBILE_MEDIA_QUERY } from "../../hooks/useIsMobile";
import { getThemeOptions } from "../../theme/appThemeOptions";

jest.mock("@material-ui/core/useMediaQuery", () => jest.fn());

const theme = createTheme(getThemeOptions("light"));

const TABS = [
  { path: "/tickets", label: "Atendimentos" },
  { path: "/contacts", label: "Contatos" },
  { path: "/kanban", label: "Kanban" },
];

function renderTabs(initialPath, mediaMatches) {
  useMediaQuery.mockImplementation((query) => {
    if (typeof query === "string") {
      return mediaMatches;
    }
    // theme.breakpoints.down("md") resolves to string via useMediaQuery(theme...)
    return mediaMatches;
  });
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Route path="*">
          <ModuleTabsLayout tabs={TABS}>
            <div data-testid="module-content">content</div>
          </ModuleTabsLayout>
        </Route>
      </MemoryRouter>
    </ThemeProvider>
  );
}

describe("conversation focus mode (ModuleTabsLayout)", () => {
  beforeEach(() => {
    useMediaQuery.mockReset();
  });

  it("mobile /tickets → tabs visíveis", () => {
    const { container, getByLabelText } = renderTabs("/tickets", true);
    expect(
      container.querySelector('[data-module-conversation-focus="false"]')
    ).toBeTruthy();
    expect(getByLabelText("module-tabs")).toBeTruthy();
  });

  it("mobile /tickets/:id → tabs ocultas (focus)", () => {
    const { container, queryByLabelText } = renderTabs("/tickets/abc-1", true);
    expect(
      container.querySelector('[data-module-conversation-focus="true"]')
    ).toBeTruthy();
    expect(queryByLabelText("module-tabs")).toBeNull();
  });

  it("mobile deep link /tickets/:id → focus ativo", () => {
    const { container } = renderTabs("/tickets/deep-uuid", true);
    expect(
      container.querySelector('[data-module-conversation-focus="true"]')
    ).toBeTruthy();
  });

  it("desktop /tickets/:id → tabs visíveis", () => {
    const { container, getByLabelText } = renderTabs("/tickets/abc-1", false);
    expect(
      container.querySelector('[data-module-conversation-focus="false"]')
    ).toBeTruthy();
    expect(getByLabelText("module-tabs")).toBeTruthy();
  });

  it("não deixa Paper/headerSpacer das tabs no focus", () => {
    const { container } = renderTabs("/tickets/abc-1", true);
    expect(container.querySelector(".MuiPaper-root")).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
  });
});

describe("breakpoint alinhamento", () => {
  it("MOBILE_MEDIA_QUERY espelha down(md) do tema", () => {
    expect(theme.breakpoints.values.md).toBe(960);
    expect(theme.breakpoints.values.sm).toBe(600);
    expect(theme.breakpoints.down("md")).toBe("@media (max-width:1279.95px)");
    expect(theme.breakpoints.down("sm")).toBe("@media (max-width:959.95px)");
    expect(MOBILE_MEDIA_QUERY).toBe("(max-width:1279.95px)");
  });

  it("action bar compact usa useIsMobile (não down sm)", () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        "../../components/TicketConversationActionBar/index.js"
      ),
      "utf8"
    );
    expect(src).toContain("useIsMobile");
    expect(src).not.toMatch(/breakpoints\.down\(["']sm["']\)/);
    expect(src).not.toContain("menuExtras");
  });

  it("faixa tablet 960–1279: compact verdadeiro (down md)", () => {
    useMediaQuery.mockReturnValue(true);
    const { container } = render(
      <ThemeProvider theme={theme}>
        <TicketConversationActionBar
          loading={false}
          userProfile="admin"
          showDelete={false}
          ticketId={1}
          onResolve={() => {}}
          onReturn={() => {}}
          onScheduleClick={() => {}}
          onTransferClick={() => {}}
          onDeleteClick={() => {}}
        />
      </ThemeProvider>
    );
    expect(
      container.querySelector('[data-ticket-action-bar][data-compact="true"]')
    ).toBeTruthy();
  });

  it("acima de md: compact falso", () => {
    useMediaQuery.mockReturnValue(false);
    const { container } = render(
      <ThemeProvider theme={theme}>
        <TicketConversationActionBar
          loading={false}
          userProfile="admin"
          showDelete={false}
          ticketId={1}
          onResolve={() => {}}
          onReturn={() => {}}
          onScheduleClick={() => {}}
          onTransferClick={() => {}}
          onDeleteClick={() => {}}
        />
      </ThemeProvider>
    );
    expect(
      container.querySelector('[data-ticket-action-bar][data-compact="false"]')
    ).toBeTruthy();
  });
});

describe("TicketConversationActionBar menu mobile", () => {
  beforeEach(() => {
    useMediaQuery.mockReturnValue(true);
  });

  it("abre menu com MenuItems rotulados e sem menuExtras horizontal", () => {
    const openTags = jest.fn();
    const { getByLabelText, queryByText, getByText } = render(
      <ThemeProvider theme={theme}>
        <TicketConversationActionBar
          loading={false}
          userProfile="admin"
          showDelete
          ticketId={9}
          onResolve={() => {}}
          onReturn={() => {}}
          onScheduleClick={() => {}}
          onTransferClick={() => {}}
          onDeleteClick={() => {}}
          onQuickRepliesClick={() => {}}
          renderExtraMenuItems={({ runMenuAction, menuItemClassName }) => (
            <li
              role="menuitem"
              className={menuItemClassName}
              onClick={runMenuAction(openTags)}
            >
              Gerenciar tags
            </li>
          )}
        />
      </ThemeProvider>
    );

    fireEvent.click(getByLabelText(/mais ações|more actions/i));
    expect(getByText("Gerenciar tags")).toBeTruthy();
    expect(queryByText(/menuExtras/)).toBeNull();
  });

  it("fecha menu antes de disparar ação (modal)", () => {
    const onSchedule = jest.fn();
    const { getByLabelText, getByText, queryByRole } = render(
      <ThemeProvider theme={theme}>
        <TicketConversationActionBar
          loading={false}
          userProfile="admin"
          showDelete={false}
          ticketId={9}
          onResolve={() => {}}
          onReturn={() => {}}
          onScheduleClick={onSchedule}
          onTransferClick={() => {}}
          onDeleteClick={() => {}}
        />
      </ThemeProvider>
    );

    fireEvent.click(getByLabelText(/mais ações|more actions/i));
    fireEvent.click(getByText("Agendamento"));
    expect(queryByRole("menu")).toBeNull();
    expect(onSchedule).toHaveBeenCalled();
  });

  it("desktop mantém IconButtons (sem menu ⋮)", () => {
    useMediaQuery.mockReturnValue(false);
    const { queryByLabelText, container } = render(
      <ThemeProvider theme={theme}>
        <TicketConversationActionBar
          loading={false}
          userProfile="admin"
          showDelete={false}
          ticketId={9}
          onResolve={() => {}}
          onReturn={() => {}}
          onScheduleClick={() => {}}
          onTransferClick={() => {}}
          onDeleteClick={() => {}}
          extraIconActions={<button type="button">crm-icon</button>}
        />
      </ThemeProvider>
    );
    expect(queryByLabelText(/mais ações|more actions/i)).toBeNull();
    expect(container.querySelector('[data-compact="false"]')).toBeTruthy();
    expect(container.textContent).toContain("crm-icon");
  });

  it("menuPaper tem overflow vertical seguro", () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        "../../components/TicketConversationActionBar/index.js"
      ),
      "utf8"
    );
    expect(src).toContain("menuPaper");
    expect(src).toContain("overflowY");
    expect(src).toContain("maxHeight");
    expect(src).toContain("safe-area");
  });
});

describe("guards estruturais open/pending/group + viewport", () => {
  const root = path.join(__dirname, "../..");

  it("action buttons: Tags/CRM owners fora do Menu (hideTrigger + refs)", () => {
    const src = fs.readFileSync(
      path.join(root, "components/TicketActionButtonsCustom/index.js"),
      "utf8"
    );
    expect(src).toContain('ticket.status === "open"');
    expect(src).toContain('ticket.status === "pending"');
    expect(src).toContain('ticket.status === "closed"');
    expect(src).toContain("isGroupConversation");
    expect(src).toContain("ticket-mobile-dialog-owners");
    expect(src).toContain("hideTrigger");
    expect(src).toContain("tagsOwnerRef");
    expect(src).toContain("crmOwnerRef");
    expect(src).toContain("manageTagsMenuLabel");
    expect(src).toContain("renderExtraMenuItems");
    expect(src).toContain("extraIconActions");
    expect(src).not.toContain("menuExtras");
  });

  it("gates CRM/delete/inventory preservados", () => {
    const src = fs.readFileSync(
      path.join(root, "components/TicketActionButtonsCustom/index.js"),
      "utf8"
    );
    expect(src).toContain("crm.pipeline");
    expect(src).toContain("showCrmSlot");
    expect(src).toContain("mayDelete");
    expect(src).toContain("TicketInventorySaleButton");
    expect(src).toContain("handleToggleChatbotForContact");
  });

  it("visualViewport / teclado não foram reescritos", () => {
    const ticketAdv = fs.readFileSync(
      path.join(root, "pages/TicketsAdvanced/index.js"),
      "utf8"
    );
    expect(ticketAdv).toContain("useMobileVisualViewport");
    const css = fs.readFileSync(
      path.join(root, "styles/mobileViewport.css"),
      "utf8"
    );
    expect(css).toContain("shc-ticket-conversation-mobile");
    expect(css).toContain("shc-ticket-keyboard-open");
    expect(css).toContain("--app-vv-height");
  });
});
