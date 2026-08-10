/**
 * Helpers de rota/navegação da conversa de ticket.
 */
import {
  TICKET_NAV_ORIGIN_INBOX,
  isTicketConversationPath,
  buildTicketConversationLocation,
  resolveTicketConversationBack,
  leaveTicketConversation,
  resolveAcceptTicketNavigation,
} from "../ticketConversationRoute";

describe("isTicketConversationPath", () => {
  it("aceita apenas /tickets/:ticketId real", () => {
    expect(isTicketConversationPath("/tickets/abc-123")).toBe(true);
    expect(isTicketConversationPath("/tickets/abc-123/")).toBe(true);
  });

  it("rejeita lista e paths ambíguos", () => {
    expect(isTicketConversationPath("/tickets")).toBe(false);
    expect(isTicketConversationPath("/tickets/")).toBe(false);
    expect(isTicketConversationPath("/tickets?x=1")).toBe(false);
    expect(isTicketConversationPath("/other/tickets/1")).toBe(false);
    expect(isTicketConversationPath("/tickets/undefined")).toBe(false);
    expect(isTicketConversationPath("/tickets/null")).toBe(false);
    expect(isTicketConversationPath("")).toBe(false);
    expect(isTicketConversationPath(null)).toBe(false);
  });

  it("ignora query/hash no pathname composto", () => {
    expect(isTicketConversationPath("/tickets/abc?foo=1")).toBe(true);
    expect(isTicketConversationPath("/tickets/abc#x")).toBe(true);
  });
});

describe("buildTicketConversationLocation / histórico", () => {
  it("marca origem da lista com fromInbox", () => {
    expect(buildTicketConversationLocation("u1", { fromInbox: true })).toEqual({
      pathname: "/tickets/u1",
      state: { ticketNavOrigin: TICKET_NAV_ORIGIN_INBOX },
    });
  });

  it("preserva search inboxTab=groups com fromInbox", () => {
    expect(
      buildTicketConversationLocation("g1", {
        fromInbox: true,
        search: "?inboxTab=groups",
      })
    ).toEqual({
      pathname: "/tickets/g1",
      search: "?inboxTab=groups",
      state: { ticketNavOrigin: TICKET_NAV_ORIGIN_INBOX },
    });
  });

  it("deep link sem state", () => {
    expect(buildTicketConversationLocation("u1")).toBe("/tickets/u1");
  });

  it("lista → voltar usa goBack (sem ping-pong)", () => {
    const goBack = jest.fn();
    const replace = jest.fn();
    const result = resolveTicketConversationBack({
      history: { goBack, replace },
      location: { state: { ticketNavOrigin: TICKET_NAV_ORIGIN_INBOX } },
    });
    expect(result).toBe("back");
    expect(goBack).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("deep link → fallback replace /tickets", () => {
    const goBack = jest.fn();
    const replace = jest.fn();
    const result = resolveTicketConversationBack({
      history: { goBack, replace },
      location: { state: null },
    });
    expect(result).toBe("replace");
    expect(replace).toHaveBeenCalledWith("/tickets");
    expect(goBack).not.toHaveBeenCalled();
  });

  it("ticket inválido/removido → leave com replace", () => {
    const replace = jest.fn();
    const push = jest.fn();
    leaveTicketConversation({ history: { replace, push }, replace: true });
    expect(replace).toHaveBeenCalledWith("/tickets");
    expect(push).not.toHaveBeenCalled();
  });
});

describe("resolveAcceptTicketNavigation", () => {
  it("fromInbox true → push com marker", () => {
    expect(
      resolveAcceptTicketNavigation({
        fromInbox: true,
        targetUuid: "x",
        currentPathname: "/tickets",
      })
    ).toEqual({
      type: "push",
      location: {
        pathname: "/tickets/x",
        state: { ticketNavOrigin: TICKET_NAV_ORIGIN_INBOX },
      },
    });
  });

  it("fromInbox false na mesma rota → stay", () => {
    expect(
      resolveAcceptTicketNavigation({
        fromInbox: false,
        targetUuid: "x",
        currentPathname: "/tickets/x",
      })
    ).toEqual({ type: "stay" });
  });

  it("fromInbox false em outra rota → push sem marker", () => {
    expect(
      resolveAcceptTicketNavigation({
        fromInbox: false,
        targetUuid: "x",
        currentPathname: "/tickets",
      })
    ).toEqual({
      type: "push",
      location: "/tickets/x",
    });
  });
});
