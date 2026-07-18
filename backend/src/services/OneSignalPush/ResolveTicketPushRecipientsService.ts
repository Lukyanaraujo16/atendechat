import { Op } from "sequelize";
import User from "../../models/User";
import Queue from "../../models/Queue";
import {
  filterUserIdsByWhatsappTicketVisibility,
  isWhatsappTicketVisibilityPrivileged
} from "../../helpers/whatsappTicketVisibility";
import { loadCompanyUnassignedTicketsQueueId } from "../../helpers/unassignedTicketsVisibility";

const nonSuperTenantClause = {
  [Op.or]: [{ super: false }, { super: null }]
};

/** Admins da empresa (recebem notificações globais do tenant, alinhado a libs/socket). */
async function listAdminUserIds(companyId: number): Promise<number[]> {
  const rows = await User.findAll({
    where: {
      companyId,
      profile: "admin",
      ...nonSuperTenantClause
    },
    attributes: ["id"]
  });
  return rows.map(u => u.id);
}

/** Supervisores da empresa. */
async function listSupervisorUserIds(companyId: number): Promise<number[]> {
  const rows = await User.findAll({
    where: {
      companyId,
      profile: "supervisor",
      ...nonSuperTenantClause
    },
    attributes: ["id"]
  });
  return rows.map(u => u.id);
}

/** Utilizadores com a fila indicada (não inclui admins por omissão). */
async function listUserIdsInQueue(
  companyId: number,
  queueId: number
): Promise<number[]> {
  const rows = await User.findAll({
    where: { companyId, ...nonSuperTenantClause },
    include: [
      {
        model: Queue,
        as: "queues",
        where: { id: queueId },
        attributes: [],
        through: { attributes: [] },
        required: true
      }
    ],
    attributes: ["id"]
  });
  return rows.map(u => u.id);
}

/** Utilizadores com tickets sem setor (allTicket), excl. admins (admins entram via regra global). */
async function listUserIdsAllTicketNoQueue(companyId: number): Promise<number[]> {
  const rows = await User.findAll({
    where: {
      companyId,
      allTicket: "enabled",
      ...nonSuperTenantClause
    },
    attributes: ["id"]
  });
  return rows.map(u => u.id);
}

/** Utilizadores do setor de contingência da empresa (visibilidade de queueId null). */
async function listUserIdsInUnassignedContingencyQueue(
  companyId: number
): Promise<number[]> {
  const contingencyQueueId = await loadCompanyUnassignedTicketsQueueId(
    companyId
  );
  if (contingencyQueueId == null) {
    return [];
  }
  return listUserIdsInQueue(companyId, contingencyQueueId);
}

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids.filter(id => id != null && !Number.isNaN(Number(id))))];
}

async function applyWhatsappVisibilityFilter(
  companyId: number,
  whatsappId: number | null | undefined,
  recipientIds: number[]
): Promise<number[]> {
  return filterUserIdsByWhatsappTicketVisibility(
    companyId,
    whatsappId,
    recipientIds
  );
}

/**
 * Pending / transferência para setor / voltou a aguardar:
 * admins + fila (se houver) ou utilizadores com allTicket se fila nula.
 */
export async function resolveRecipientsForPendingOrQueue(
  companyId: number,
  queueId: number | null,
  whatsappId?: number | null
): Promise<number[]> {
  const adminIds = await listAdminUserIds(companyId);
  const supervisorIds = await listSupervisorUserIds(companyId);
  let ids: number[];

  if (queueId != null) {
    const inQueue = await listUserIdsInQueue(companyId, queueId);
    ids = uniqueIds([...adminIds, ...supervisorIds, ...inQueue]);
  } else {
    const noSector = await listUserIdsAllTicketNoQueue(companyId);
    const contingency = await listUserIdsInUnassignedContingencyQueue(
      companyId
    );
    ids = uniqueIds([
      ...adminIds,
      ...supervisorIds,
      ...noSector,
      ...contingency
    ]);
  }

  return applyWhatsappVisibilityFilter(companyId, whatsappId, ids);
}

/**
 * Mensagem inbound (regra B): responsável; senão fila só; senão sem setor + admins.
 */
export async function resolveRecipientsForInboundMessage(
  companyId: number,
  ticket: {
    userId?: number | null;
    queueId?: number | null;
    whatsappId?: number | null;
  }
): Promise<number[]> {
  const assigneeId = ticket.userId != null ? Number(ticket.userId) : null;
  if (assigneeId) {
    const u = await User.findOne({
      where: { id: assigneeId, companyId, ...nonSuperTenantClause },
      attributes: ["id", "profile"]
    });
    if (!u) return [];
    const ids = [u.id];
    return applyWhatsappVisibilityFilter(companyId, ticket.whatsappId, ids);
  }

  const qid = ticket.queueId != null ? Number(ticket.queueId) : null;
  if (qid) {
    const inQueue = await listUserIdsInQueue(companyId, qid);
    return applyWhatsappVisibilityFilter(
      companyId,
      ticket.whatsappId,
      uniqueIds(inQueue)
    );
  }

  return resolveRecipientsForPendingOrQueue(
    companyId,
    null,
    ticket.whatsappId
  );
}

/** Utilizadores privilegiados para conexão restrita (push direto). */
export async function listPrivilegedUserIdsForRestrictedWhatsapp(
  companyId: number
): Promise<number[]> {
  const rows = await User.findAll({
    where: {
      companyId,
      profile: { [Op.in]: ["admin", "supervisor"] },
      ...nonSuperTenantClause
    },
    attributes: ["id"]
  });
  return rows.map(u => u.id);
}

export { isWhatsappTicketVisibilityPrivileged };
