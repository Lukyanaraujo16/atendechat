import User from "../models/User";

export type AiAgentProductAuthUser = {
  id?: number | string;
  profile?: string;
  supportMode?: boolean;
  super?: boolean;
};

/**
 * Predicado central de mutação/visualização comercial do Product AI Agent.
 *
 * canManageAiAgentProduct =
 *   admin do tenant (sessão sem supportMode)
 *   OR Super Admin autenticado com supportMode no tenant alvo (JWT companyId)
 *
 * A empresa alvo é sempre `req.user.companyId` (token), nunca body/query.
 */
export function canManageAiAgentProductSync(
  user: AiAgentProductAuthUser | null | undefined,
  dbSuper?: boolean | null
): boolean {
  if (!user) return false;

  const supportMode = user.supportMode === true;
  const profile = String(user.profile || "").toLowerCase();

  if (supportMode) {
    if (dbSuper === true) return true;
    if (user.super === true) return true;
    return false;
  }

  return profile === "admin";
}

/**
 * Confirma Super Admin real no banco quando a sessão está em supportMode.
 * Não aceita supportMode de perfis comuns.
 */
export async function resolveAiAgentProductManageAccess(
  user: AiAgentProductAuthUser | null | undefined
): Promise<{ allowed: boolean; isSupportMutation: boolean; isSuper: boolean }> {
  if (!user) {
    return { allowed: false, isSupportMutation: false, isSuper: false };
  }

  const supportMode = user.supportMode === true;
  if (!supportMode) {
    const allowed = canManageAiAgentProductSync(user, null);
    return { allowed, isSupportMutation: false, isSuper: false };
  }

  const userId = Number(user.id);
  if (!Number.isFinite(userId)) {
    return { allowed: false, isSupportMutation: true, isSuper: false };
  }

  const row = await User.findByPk(userId, {
    attributes: ["id", "super", "profile"]
  });
  const isSuper = row?.super === true;
  return {
    allowed: canManageAiAgentProductSync(user, isSuper),
    isSupportMutation: true,
    isSuper
  };
}

export async function assertCanManageAiAgentProduct(input: {
  authenticatedUser: AiAgentProductAuthUser | null | undefined;
}): Promise<{
  allowed: boolean;
  isSupportMutation: boolean;
  isSuper: boolean;
}> {
  return resolveAiAgentProductManageAccess(input.authenticatedUser);
}
