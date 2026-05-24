/** Admin, supervisor, super ou supportMode podem gerenciar responsáveis de contatos. */
export function canManageContactAssignments(user) {
  if (!user) return false;
  if (user.super === true || user.supportMode === true) return true;
  const profile = String(user.profile || "");
  return profile === "admin" || profile === "supervisor";
}

export default canManageContactAssignments;
