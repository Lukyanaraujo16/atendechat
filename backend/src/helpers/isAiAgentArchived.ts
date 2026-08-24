/**
 * Soft archive do AiAgent (Fase 2.21C).
 * Sem paranoid Sequelize — Product filtra `archivedAt IS NULL` explicitamente.
 */

export function isAiAgentArchived(
  agent: { archivedAt?: Date | string | null } | null | undefined
): boolean {
  return agent != null && agent.archivedAt != null && agent.archivedAt !== "";
}

/** Cláusula Sequelize: agentes operacionais (não arquivados). */
export function aiAgentNotArchivedWhere(): { archivedAt: null } {
  return { archivedAt: null };
}

export function withAiAgentNotArchived<T extends Record<string, unknown>>(
  where: T
): T & { archivedAt: null } {
  return { ...where, archivedAt: null };
}
