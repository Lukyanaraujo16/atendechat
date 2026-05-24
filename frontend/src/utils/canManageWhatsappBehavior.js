/** Alinhado a requireWhatsappBehaviorManager: admin, supervisor ou suporte. */
export function canManageWhatsappBehavior(user) {
  if (!user) return false;
  if (user.supportMode === true) return true;
  const profile = String(user.profile || "").toLowerCase();
  return profile === "admin" || profile === "supervisor";
}
