/** Convite ao admin principal após aprovação (alinhado com provisionPrimaryAdminForCompany). */
export const PRIMARY_ADMIN_INVITE_TTL_MS = 72 * 60 * 60 * 1000;

/** Badge / filtro “Novos”: pendentes nas últimas N horas (alinhado ao alerta NEW_SIGNUP). */
export const SIGNUP_NEW_BADGE_HOURS = 48;

/** Alerta: pendente sem análise há N+ dias. */
export const SIGNUP_PENDING_STALE_DAYS = 7;

/** Alerta: convite enviado há N+ dias e ainda sem ativação. */
export const SIGNUP_INVITE_STALE_DAYS = 3;

/** Limite inferior de `createdAt` para pendentes “novos” (filtro e contagem). */
export function signupQueryNewPendingFrom(): Date {
  return new Date(Date.now() - SIGNUP_NEW_BADGE_HOURS * 3600 * 1000);
}

/** Pedidos pendentes com `createdAt` ≤ este instante são “pendente parado” (PENDING_STALE). */
export function signupQueryPendingStaleBefore(): Date {
  return new Date(Date.now() - SIGNUP_PENDING_STALE_DAYS * 86400000);
}

/** Convites com `invitationSentAt` ≤ este instante são “provavelmente expirados” (INVITE_LIKELY_EXPIRED). */
export function signupQueryInviteExpiredBefore(): Date {
  return new Date(Date.now() - PRIMARY_ADMIN_INVITE_TTL_MS);
}
