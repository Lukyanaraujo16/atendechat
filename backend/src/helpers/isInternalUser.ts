/**
 * Identidade interna da plataforma (Architecture Lock §19).
 *
 * Contrato aprovado:
 *   user.super === true || user.profile === "superadmin"
 *
 * Não considera: admin de tenant, supportMode, features de plano.
 */

export type InternalUserIdentity = {
  super?: boolean | null;
  profile?: string | null;
} | null | undefined;

export function isInternalUser(user: InternalUserIdentity): boolean {
  if (!user) return false;
  if (user.super === true) return true;
  if (user.profile === "superadmin") return true;
  return false;
}

export default isInternalUser;
