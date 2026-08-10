/**
 * @jest-environment jsdom
 *
 * Testes comportamentais: Tags/CRM fora do Menu, gates, histórico integrado, breakpoint.
 */
import React from "react";
import {
  render,
  fireEvent,
  act,
  screen,
} from "@testing-library/react";
import { createMemoryHistory } from "history";
import { Router } from "react-router-dom";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import useMediaQuery from "@material-ui/core/useMediaQuery";

import TicketActionButtonsCustom from "../../components/TicketActionButtonsCustom";
import TicketConversationActionBar from "../../components/TicketConversationActionBar";
import { AuthContext } from "../../context/Auth/AuthContext";
import { TicketsSetContext } from "../../context/Tickets/TicketsContext";
import { TicketsInboxContext } from "../../context/TicketsInboxContext";
import { useTicketInventorySales } from "../../components/Inventory/TicketInventorySalesProvider";
import { getThemeOptions } from "../../theme/appThemeOptions";
import {
  TICKET_NAV_ORIGIN_INBOX,
  buildTicketConversationLocation,
  resolveTicketConversationBack,
  leaveTicketConversation,
  resolveAcceptTicketNavigation,
} from "../ticketConversationRoute";

if (typeof global.MutationObserver === "undefined") {
  global.MutationObserver = class {
    observe() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

jest.mock("@material-ui/core/useMediaQuery", () => jest.fn());

jest.mock("../../hooks/usePlanFlags", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("../../hooks/useAcceptTicket", () => ({
  useAcceptTicket: () => ({ completeAcceptTicket: jest.fn() }),
}));

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("../../components/Inventory/TicketInventorySalesProvider", () => ({
  useTicketInventorySales: jest.fn(() => ({ enabled: false })),
  TicketInventorySalesProvider: ({ children }) => children,
}));

jest.mock("../../components/TicketActionModals", () => ({
  __esModule: true,
  default: ({ children }) =>
    children({
      openSchedule: jest.fn(),
      openDelete: jest.fn(),
    }),
}));

jest.mock("../../components/TicketFlowExecutionLogModal", () => ({
  __esModule: true,
  default: ({ renderTrigger }) =>
    typeof renderTrigger === "function" ? renderTrigger(jest.fn()) : null,
}));

jest.mock("../../components/Crm/CrmDealFormDialog", () => ({
  __esModule: true,
  default: ({ open }) =>
    open ? <div data-testid="crm-form-dialog">CRM Form</div> : null,
}));

jest.mock("../../components/Crm/CrmOpenDealsChoiceDialog", () => ({
  __esModule: true,
  default: ({ open, deals }) =>
    open ? (
      <div data-testid="crm-choice-dialog">
        CRM Choice {(deals || []).length}
      </div>
    ) : null,
}));

jest.mock("../../components/TagsContainer", () => {
  const React = require("react");
  const Actual = jest.requireActual("../../components/TagsContainer");
  return {
    ...Actual,
    TicketTagsButton: React.forwardRef(function MockTagsButton(
      { ticket, hideTrigger },
      ref
    ) {
      const [open, setOpen] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        open: () => setOpen(true),
        close: () => setOpen(false),
        getTagCount: () =>
          Array.isArray(ticket?.tags) ? ticket.tags.length : 0,
      }));
      if (!ticket?.id) return null;
      return (
        <>
          {!hideTrigger ? (
            <button type="button" onClick={() => setOpen(true)}>
              tags-icon
            </button>
          ) : null}
          {open ? (
            <div data-testid="ticket-tags-dialog">
              Tags Editor
              <button type="button" onClick={() => setOpen(false)}>
                Fechar tags
              </button>
            </div>
          ) : null}
        </>
      );
    }),
  };
});

const usePlanFlags = require("../../hooks/usePlanFlags").default;
const api = require("../../services/api").default;

const theme = createTheme(getThemeOptions("light"));

function renderOpenActions({
  user,
  ticket,
  contact,
  planFlags,
  inventoryEnabled = false,
  mediaMatches = true,
}) {
  useMediaQuery.mockReturnValue(mediaMatches);
  usePlanFlags.mockReturnValue(
    planFlags || {
      ready: true,
      loaded: true,
      effectiveFeatures: { "crm.pipeline": true },
    }
  );
  useTicketInventorySales.mockReturnValue(
    inventoryEnabled
      ? {
          enabled: true,
          opening: false,
          handleSaleButtonClick: jest.fn(),
        }
      : { enabled: false }
  );

  const history = createMemoryHistory({ initialEntries: ["/tickets/t1"] });

  const view = render(
    <ThemeProvider theme={theme}>
      <Router history={history}>
        <AuthContext.Provider value={{ user }}>
          <TicketsSetContext.Provider value={jest.fn()}>
            <TicketsInboxContext.Provider value={{}}>
              <TicketActionButtonsCustom
                ticket={ticket}
                contact={contact}
                onOpenQuickReplies={jest.fn()}
                onOpenTransfer={jest.fn()}
              />
            </TicketsInboxContext.Provider>
          </TicketsSetContext.Provider>
        </AuthContext.Provider>
      </Router>
    </ThemeProvider>
  );

  return { ...view, history };
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

const baseTicket = {
  id: 10,
  uuid: "ticket-uuid-10",
  status: "open",
  contactId: 55,
  tags: [{ id: 1 }, { id: 2 }, { id: 3 }],
};

const baseContact = { id: 55, chatbotDisabled: false };

describe("Tags/CRM owners fora do Menu", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: [] });
  });

  it("Tags: menu fecha e dialog permanece aberto; fecha normalmente", async () => {
    renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: baseContact,
    });

    expect(screen.getByTestId("ticket-mobile-dialog-owners")).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.getByTestId("ticket-menu-manage-tags").textContent).toContain(
      "(3)"
    );
    fireEvent.click(screen.getByTestId("ticket-menu-manage-tags"));

    await flushAsync();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("ticket-tags-dialog")).toBeTruthy();

    fireEvent.click(screen.getByText("Fechar tags"));
    await flushAsync();
    expect(screen.queryByTestId("ticket-tags-dialog")).toBeNull();
  });

  it("CRM sem oportunidades: menu fecha e form permanece montado", async () => {
    api.get.mockResolvedValue({ data: [] });
    renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: baseContact,
    });

    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    fireEvent.click(screen.getByTestId("ticket-menu-crm"));

    await flushAsync();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("crm-form-dialog")).toBeTruthy();
  });

  it("CRM com oportunidades existentes: choice dialog permanece após fechar menu", async () => {
    api.get.mockResolvedValue({
      data: [{ id: 99, status: "open", title: "Deal A" }],
    });
    renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: baseContact,
    });

    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    fireEvent.click(screen.getByTestId("ticket-menu-crm"));

    await flushAsync();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("crm-choice-dialog")).toBeTruthy();
  });

  it("CRM 403: menu fecha e owner permanece montado sem form", async () => {
    const err = {
      response: {
        status: 403,
        data: { error: "ERR_NO_PERMISSION" },
      },
    };
    api.get.mockRejectedValue(err);
    renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: baseContact,
    });

    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    fireEvent.click(screen.getByTestId("ticket-menu-crm"));

    await flushAsync();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.queryByTestId("crm-form-dialog")).toBeNull();
    expect(screen.queryByTestId("crm-choice-dialog")).toBeNull();
    expect(screen.getByTestId("ticket-mobile-dialog-owners")).toBeTruthy();
  });
});

describe("gates comportamentais do menu mobile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ data: [] });
  });

  it("CRM permitido aparece; bloqueado não aparece", () => {
    const { unmount } = renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: baseContact,
      planFlags: {
        ready: true,
        loaded: true,
        effectiveFeatures: { "crm.pipeline": true },
      },
    });
    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.getByTestId("ticket-menu-crm")).toBeTruthy();
    unmount();

    renderOpenActions({
      user: {
        id: 1,
        profile: "user",
        effectiveUserFeatures: { "crm.pipeline": false },
      },
      ticket: baseTicket,
      contact: baseContact,
      planFlags: {
        ready: true,
        loaded: true,
        effectiveFeatures: { "crm.pipeline": true },
      },
    });
    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.queryByTestId("ticket-menu-crm")).toBeNull();
  });

  it("Inventory permitido aparece; bloqueado não aparece", () => {
    const { unmount } = renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: baseContact,
      inventoryEnabled: true,
    });
    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.getByTestId("ticket-menu-inventory")).toBeTruthy();
    unmount();

    renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: baseContact,
      inventoryEnabled: false,
    });
    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.queryByTestId("ticket-menu-inventory")).toBeNull();
  });

  it("Delete permitido aparece; bloqueado não aparece", () => {
    const { unmount } = renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: baseContact,
    });
    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.getByText(/deletar|delete/i)).toBeTruthy();
    unmount();

    renderOpenActions({
      user: { id: 1, profile: "user" },
      ticket: baseTicket,
      contact: baseContact,
    });
    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.queryByText(/deletar|delete/i)).toBeNull();
  });

  it("Chatbot: label Ativar/Desativar conforme estado; exige contact", () => {
    const { unmount } = renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: { id: 55, chatbotDisabled: true },
    });
    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.getByTestId("ticket-menu-chatbot").textContent).toMatch(
      /ativar chatbot/i
    );
    unmount();

    renderOpenActions({
      user: { id: 1, profile: "admin" },
      ticket: baseTicket,
      contact: { id: 55, chatbotDisabled: false },
    });
    fireEvent.click(screen.getByLabelText(/mais ações|more actions/i));
    expect(screen.getByTestId("ticket-menu-chatbot").textContent).toMatch(
      /desativar chatbot/i
    );
  });
});

describe("breakpoint action bar alinhado à conversa mobile", () => {
  it("compact abaixo de md e desktop acima", () => {
    useMediaQuery.mockReturnValue(true);
    const { container, unmount } = render(
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
    expect(container.querySelector('[data-compact="true"]')).toBeTruthy();
    unmount();

    useMediaQuery.mockReturnValue(false);
    const desktop = render(
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
          extraIconActions={<button type="button">desk-icon</button>}
        />
      </ThemeProvider>
    );
    expect(
      desktop.container.querySelector('[data-compact="false"]')
    ).toBeTruthy();
    expect(desktop.container.textContent).toContain("desk-icon");
    expect(desktop.queryByLabelText(/mais ações|more actions/i)).toBeNull();
  });

  it("tema: sm=600 md=960; faixa 960–1279 usa down(md)", () => {
    expect(theme.breakpoints.values.sm).toBe(600);
    expect(theme.breakpoints.values.md).toBe(960);
    expect(theme.breakpoints.down("md")).toContain("1279.95");
    expect(theme.breakpoints.down("sm")).toContain("959.95");
  });
});

describe("histórico integrado (MemoryHistory)", () => {
  it("A) inbox → ticket → voltar interno → browser back não reabre (sem ping-pong)", () => {
    const history = createMemoryHistory({ initialEntries: ["/tickets"] });
    history.push(
      buildTicketConversationLocation("aaa", { fromInbox: true })
    );
    expect(history.location.pathname).toBe("/tickets/aaa");
    expect(history.location.state.ticketNavOrigin).toBe(TICKET_NAV_ORIGIN_INBOX);

    resolveTicketConversationBack({
      history,
      location: history.location,
    });
    expect(history.location.pathname).toBe("/tickets");

    history.goBack();
    expect(history.location.pathname).toBe("/tickets");
  });

  it("B) ticket A → voltar → ticket B → voltar", () => {
    const history = createMemoryHistory({ initialEntries: ["/tickets"] });
    history.push(buildTicketConversationLocation("A", { fromInbox: true }));
    resolveTicketConversationBack({ history, location: history.location });
    expect(history.location.pathname).toBe("/tickets");

    history.push(buildTicketConversationLocation("B", { fromInbox: true }));
    resolveTicketConversationBack({ history, location: history.location });
    expect(history.location.pathname).toBe("/tickets");
  });

  it("C) deep link → replace /tickets", () => {
    const history = createMemoryHistory({
      initialEntries: ["/tickets/deep-1"],
    });
    resolveTicketConversationBack({
      history,
      location: { state: null },
    });
    expect(history.location.pathname).toBe("/tickets");
  });

  it("D) ticket inválido → leave replace", () => {
    const history = createMemoryHistory({
      initialEntries: ["/tickets/gone"],
    });
    leaveTicketConversation({ history, replace: true });
    expect(history.location.pathname).toBe("/tickets");
  });

  it("E) accept ticket originado da inbox preserva marker", () => {
    const loc = buildTicketConversationLocation("accepted-1", {
      fromInbox: true,
    });
    expect(loc.state.ticketNavOrigin).toBe(TICKET_NAV_ORIGIN_INBOX);
    const history = createMemoryHistory({ initialEntries: ["/tickets"] });
    history.push(loc);
    resolveTicketConversationBack({ history, location: history.location });
    expect(history.location.pathname).toBe("/tickets");
  });

  it("F) groups: inboxTab=groups preservado no push; goBack restaura origem", () => {
    const history = createMemoryHistory({
      initialEntries: ["/tickets?inboxTab=groups"],
    });
    history.push(
      buildTicketConversationLocation("g1", {
        fromInbox: true,
        search: "?inboxTab=groups",
      })
    );
    expect(history.location.pathname).toBe("/tickets/g1");
    expect(history.location.search).toBe("?inboxTab=groups");
    expect(history.location.state.ticketNavOrigin).toBe(TICKET_NAV_ORIGIN_INBOX);

    resolveTicketConversationBack({ history, location: history.location });
    expect(history.location.pathname).toBe("/tickets");
    expect(history.location.search).toBe("?inboxTab=groups");
  });
});

describe("aceite: fromInbox explícito (resolveAcceptTicketNavigation)", () => {
  function applyAcceptNav(history, { fromInbox, targetUuid, search }) {
    const nav = resolveAcceptTicketNavigation({
      fromInbox,
      targetUuid,
      currentPathname: history.location.pathname,
      search,
    });
    if (nav?.type === "push") {
      history.push(nav.location);
    }
    return nav;
  }

  it("CENÁRIO 1 — inbox: aceitar marca fromInbox e voltar → /tickets", () => {
    const history = createMemoryHistory({ initialEntries: ["/tickets"] });
    const nav = applyAcceptNav(history, {
      fromInbox: true,
      targetUuid: "acc-1",
    });
    expect(nav.type).toBe("push");
    expect(history.location.pathname).toBe("/tickets/acc-1");
    expect(history.location.state.ticketNavOrigin).toBe(TICKET_NAV_ORIGIN_INBOX);
    expect(history.length).toBe(2);

    resolveTicketConversationBack({ history, location: history.location });
    expect(history.location.pathname).toBe("/tickets");
  });

  it("CENÁRIO 2 — deep link órfão: aceitar dentro não empilha; voltar → replace", () => {
    const history = createMemoryHistory({
      initialEntries: ["/tickets/orphan-1"],
    });
    const lengthBefore = history.length;
    const stateBefore = history.location.state;
    const nav = applyAcceptNav(history, {
      fromInbox: false,
      targetUuid: "orphan-1",
    });
    expect(nav.type).toBe("stay");
    expect(history.length).toBe(lengthBefore);
    expect(history.location.pathname).toBe("/tickets/orphan-1");
    expect(history.location.state).toBe(stateBefore);

    resolveTicketConversationBack({
      history,
      location: history.location,
    });
    expect(history.location.pathname).toBe("/tickets");
  });

  it("CENÁRIO 3 — aberto da inbox: aceitar na conversa preserva marker e não empilha", () => {
    const history = createMemoryHistory({ initialEntries: ["/tickets"] });
    history.push(
      buildTicketConversationLocation("open-1", { fromInbox: true })
    );
    const lengthBefore = history.length;
    expect(history.location.state.ticketNavOrigin).toBe(TICKET_NAV_ORIGIN_INBOX);

    const nav = applyAcceptNav(history, {
      fromInbox: false,
      targetUuid: "open-1",
    });
    expect(nav.type).toBe("stay");
    expect(history.length).toBe(lengthBefore);
    expect(history.location.state.ticketNavOrigin).toBe(TICKET_NAV_ORIGIN_INBOX);

    resolveTicketConversationBack({ history, location: history.location });
    expect(history.location.pathname).toBe("/tickets");
  });

  it("CENÁRIO 4 — groups: aceitar da inbox preserva inboxTab=groups no voltar", () => {
    const history = createMemoryHistory({
      initialEntries: ["/tickets?inboxTab=groups"],
    });
    const nav = applyAcceptNav(history, {
      fromInbox: true,
      targetUuid: "grp-1",
      search: "?inboxTab=groups",
    });
    expect(nav.type).toBe("push");
    expect(history.location.pathname).toBe("/tickets/grp-1");
    expect(history.location.search).toBe("?inboxTab=groups");
    expect(history.location.state.ticketNavOrigin).toBe(TICKET_NAV_ORIGIN_INBOX);

    resolveTicketConversationBack({ history, location: history.location });
    expect(history.location.pathname).toBe("/tickets");
    expect(history.location.search).toBe("?inboxTab=groups");
  });
});
