import { Op, Filterable } from "sequelize";

/** Fila permitida OU sem fila (null) — alinhado ao Kanban; evita `Op.in` com array vazio. */
export function queueInAllowedOrUnassigned(queueIds: number[]): Filterable["where"] {
  if (!queueIds?.length) {
    return { queueId: null };
  }
  return {
    [Op.or]: [{ queueId: { [Op.in]: queueIds } }, { queueId: null }]
  };
}

/**
 * Limite de segurança: selectedQueueIds do cliente nunca amplia além das filas
 * reais do utilizador. Se o request não filtrar (vazio), usa membership.
 */
export function resolveEffectiveQueueIdsForAgent(
  membershipQueueIds: number[],
  requestedQueueIds: number[] | undefined | null
): number[] {
  const membership = (membershipQueueIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  const requested = (requestedQueueIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
  if (!requested.length) {
    return membership;
  }
  const set = new Set(membership);
  return requested.filter((id) => set.has(id));
}

/**
 * Visibilidade para atendente (não showAll):
 * - tickets com userId = eu (qualquer fila / null / status filtrado pela query);
 * - tickets pending sem responsável, na “piscina” das filas do utilizador
 *   (e opcionalmente sem fila se allTicket ou setor de contingência da empresa).
 */
export function buildNonAdminTicketListWhere(
  userPk: string | number,
  queueIds: number[],
  allowNullQueueTickets: boolean
): Filterable["where"] {
  const me = Number(userPk);

  const unassignedQueueClause: Filterable["where"] = (() => {
    if (!queueIds?.length) {
      if (allowNullQueueTickets) {
        return { queueId: null };
      }
      return { id: { [Op.in]: [] as number[] } };
    }
    if (allowNullQueueTickets) {
      return {
        [Op.or]: [{ queueId: { [Op.in]: queueIds } }, { queueId: null }]
      };
    }
    return { queueId: { [Op.in]: queueIds } };
  })();

  return {
    [Op.or]: [
      { userId: me },
      {
        [Op.and]: [
          { userId: { [Op.is]: null } },
          { status: "pending" },
          unassignedQueueClause
        ]
      }
    ]
  };
}
