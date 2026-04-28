/**
 * Pode usar rotas /saas (sem empresa). Com companyId (ex.: modo suporte) usa o layout tenant.
 * Regra: super OU perfil admin, e sem tenant no token.
 */
export function canAccessSaasPlatform(user) {
  if (!user || typeof user !== "object") return false;
  const hasCompany =
    user.companyId != null && user.companyId !== "";
  if (hasCompany) return false;
  return Boolean(user.super) || user.profile === "admin";
}
