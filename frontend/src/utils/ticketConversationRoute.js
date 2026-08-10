/**
 * Rotas e navegação da conversa de ticket (helpers puros / testáveis).
 *
 * Regras de voltar:
 * A) Aberto pela lista (`state.ticketNavOrigin = ticketsInbox`) → `history.goBack()`
 *    (evita ping-pong lista → ticket → push(/tickets) → back reabre ticket).
 * B) Deep link / sem marcador → `history.replace("/tickets")` (fallback seguro).
 * C) Ticket deletado/inválido → `leaveTicketConversation({ replace: true })`.
 *
 * Origens com fromInbox: lista/inbox (TicketListItem*), NewTicketModal via
 * TicketsManagerTabs, aceite **explícito** `completeAcceptTicket(..., { fromInbox: true })`,
 * GroupInboxListItem, TicketsContext (desktop).
 * NÃO marcar: aceite dentro da conversa/órfão (`fromInbox: false`), push/notificações,
 * CRM, Kanban, Contatos, deep links externos.
 */

/** Marcador de origem: ticket aberto a partir da lista de Atendimentos. */
export const TICKET_NAV_ORIGIN_INBOX = "ticketsInbox";

/**
 * True apenas para `/tickets/:ticketId` com id real.
 * False para `/tickets`, `/tickets/`, query-only, ou paths ambíguos.
 *
 * @param {string} [pathname]
 * @returns {boolean}
 */
export function isTicketConversationPath(pathname) {
  if (pathname == null || typeof pathname !== "string") return false;
  const pathOnly = pathname.split("?")[0].split("#")[0];
  const match = pathOnly.match(/^\/tickets\/([^/]+)\/?$/);
  if (!match) return false;
  const id = String(match[1] || "").trim();
  if (!id) return false;
  if (id === "undefined" || id === "null") return false;
  return true;
}

/**
 * Localização para abrir conversa.
 * @param {string} ticketUuid
 * @param {{ fromInbox?: boolean, search?: string }} [options]
 *        search: ex. "?inboxTab=groups" (preserva aba ao empilhar no history)
 */
export function buildTicketConversationLocation(
  ticketUuid,
  { fromInbox = false, search } = {}
) {
  const uuid = String(ticketUuid || "").trim();
  const pathname = `/tickets/${uuid}`;
  let searchStr;
  if (search != null && String(search).trim() !== "") {
    const raw = String(search).trim();
    searchStr = raw.startsWith("?") ? raw : `?${raw}`;
  }
  if (!fromInbox && !searchStr) {
    return pathname;
  }
  const loc = { pathname };
  if (searchStr) {
    loc.search = searchStr;
  }
  if (fromInbox) {
    loc.state = { ticketNavOrigin: TICKET_NAV_ORIGIN_INBOX };
  }
  return loc;
}

/**
 * Voltar da conversa:
 * - veio da lista (state) → goBack() para não criar ping-pong;
 * - deep link / sem state → replace('/tickets').
 *
 * @param {{ history: { goBack: Function, replace: Function }, location?: { state?: object } }} args
 * @returns {"back"|"replace"}
 */
export function resolveTicketConversationBack({ history, location } = {}) {
  const origin = location?.state?.ticketNavOrigin;
  if (origin === TICKET_NAV_ORIGIN_INBOX && history && typeof history.goBack === "function") {
    history.goBack();
    return "back";
  }
  if (history && typeof history.replace === "function") {
    history.replace("/tickets");
    return "replace";
  }
  if (history && typeof history.push === "function") {
    history.push("/tickets");
    return "replace";
  }
  return "replace";
}

/**
 * Quando a rota do ticket deixa de ser válida (delete/unauthorized).
 */
export function leaveTicketConversation({ history, replace = true } = {}) {
  if (!history) return;
  if (replace && typeof history.replace === "function") {
    history.replace("/tickets");
    return;
  }
  if (typeof history.push === "function") {
    history.push("/tickets");
  }
}

/**
 * Navegação pós-aceite.
 * - fromInbox true → push com marker (e search opcional, ex. inboxTab=groups)
 * - fromInbox false e já na mesma conversa → stay (não empilha nem inventa marker)
 * - fromInbox false e em outra rota → push sem marker
 *
 * @returns {{ type: "push"|"stay", location?: string|object }|null}
 */
export function resolveAcceptTicketNavigation({
  fromInbox = false,
  targetUuid,
  currentPathname,
  search,
} = {}) {
  const uuid = String(targetUuid || "").trim();
  if (!uuid) return null;

  if (fromInbox) {
    return {
      type: "push",
      location: buildTicketConversationLocation(uuid, {
        fromInbox: true,
        search,
      }),
    };
  }

  const pathOnly = String(currentPathname || "")
    .split("?")[0]
    .split("#")[0];
  const targetPath = `/tickets/${uuid}`;
  if (pathOnly === targetPath || pathOnly === `${targetPath}/`) {
    return { type: "stay" };
  }

  return {
    type: "push",
    location: buildTicketConversationLocation(uuid),
  };
}
