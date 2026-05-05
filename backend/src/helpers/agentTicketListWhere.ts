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
 * Visibilidade para atendente (não showAll):
 * - tickets com userId = eu (qualquer fila / null / status filtrado pela query);
 * - tickets pending sem responsável, na “piscina” das filas do utilizador (e opcionalmente sem fila se allTicket).
 */
export function buildNonAdminTicketListWhere(
  userPk: string | number,
  queueIds: number[],
  allTicketEnabled: boolean
): Filterable["where"] {
  const me = Number(userPk);

  const unassignedQueueClause: Filterable["where"] = (() => {
    if (!queueIds?.length) {
      if (allTicketEnabled) {
        return { queueId: null };
      }
      return { id: { [Op.in]: [] as number[] } };
    }
    if (allTicketEnabled) {
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
