/** Evento para pedir atualização do resumo de pedidos de cadastro (menu SaaS). */
export const SIGNUP_SUMMARY_STALE_EVENT = "atendechat-signup-summary-stale";

/** Payload do socket: atualiza contadores na central se estiver aberta. */
export const SIGNUP_REALTIME_EVENT = "atendechat-signup-realtime";

export function notifySignupSummaryStale() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SIGNUP_SUMMARY_STALE_EVENT));
  }
}

export function dispatchSignupRealtimePayload(payload) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SIGNUP_REALTIME_EVENT, { detail: payload }));
  }
}
