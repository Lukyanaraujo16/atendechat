import api from "../services/api";
import {
  isValidTicketsApiResponse,
  TICKETS_NO_CACHE_HEADERS,
} from "./ticketsApiResponse";

export const ATTENDANCE_UNREAD_REFRESH_DEBOUNCE_MS = 400;

/** Status operacionais do badge de Atendimento. Closed nunca entra. */
export const ATTENDANCE_UNREAD_STATUSES = ["open", "pending"];

const TICKET_RECONCILE_ACTIONS = new Set([
  "updateUnread",
  "update",
  "delete",
]);

export function parseTicketsCount(response) {
  if (!isValidTicketsApiResponse(response)) return 0;
  const n = Number(response.data?.count);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Conta conversas autorizadas com unreadMessages > 0 em open e pending.
 * showAll=true: o backend decide se o perfil pode ampliar a visibilidade.
 * Duas chamadas countOnly: o backend aceita status como string única.
 */
export async function fetchAttendanceUnreadConversationsCount(client = api) {
  const responses = await Promise.all(
    ATTENDANCE_UNREAD_STATUSES.map((status) =>
      client.get("/tickets", {
        params: {
          pageNumber: 1,
          status,
          withUnreadMessages: "true",
          countOnly: true,
          showAll: true,
        },
        headers: TICKETS_NO_CACHE_HEADERS,
      })
    )
  );

  return responses.reduce((sum, response) => sum + parseTicketsCount(response), 0);
}

export function shouldReconcileAttendanceUnreadFromAppMessage(data) {
  if (!data || data.action !== "create") return false;
  if (data.message?.fromMe === true) return false;
  if (data.ticket?.isGroup === true) return false;
  return true;
}

export function shouldReconcileAttendanceUnreadFromTicket(data) {
  return TICKET_RECONCILE_ACTIONS.has(data?.action);
}
