/**
 * Autorização comercial do Product Hub / Agente de IA.
 *
 * canManageAiAgentProduct =
 *   admin do tenant (fora do suporte)
 *   OR Super Admin autenticado em modo suporte no tenant alvo
 *
 * Não libera:
 * - supportMode sem identidade Super Admin;
 * - Super Admin fora do contexto oficial de suporte operando outro tenant;
 * - supervisor / user comum.
 */

function isTruthy(value) {
  return value === true;
}

/** Super Admin real (campo de sessão; nunca confiar só em profile). */
export function isAiAgentSuperAdmin(user) {
  return isTruthy(user?.super);
}

/** Sessão oficial de suporte no tenant (JWT/sessão serializada). */
export function isAiAgentSupportMode(user) {
  return isTruthy(user?.supportMode);
}

/**
 * Pode mutar Product AI Agent no contexto atual da sessão.
 * Tenant vem de user.companyId (resolvido no backend; FE não envia companyId).
 */
export function canManageAiAgentProduct(user) {
  if (!user || typeof user !== "object") return false;

  if (isAiAgentSupportMode(user)) {
    return isAiAgentSuperAdmin(user);
  }

  return String(user.profile || "").toLowerCase() === "admin";
}

/**
 * Pode abrir rotas/páginas comerciais do Agente de IA.
 * Mesmo predicado de manage: o módulo é admin-only; suporte só com Super Admin.
 */
export function canAccessAiAgentProduct(user) {
  return canManageAiAgentProduct(user);
}

/** Alias semântico usado em CTAs / forms. */
export function canMutateAiAgentInCurrentContext(user) {
  return canManageAiAgentProduct(user);
}
