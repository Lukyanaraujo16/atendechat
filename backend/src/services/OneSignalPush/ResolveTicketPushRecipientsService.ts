import { Op } from "sequelize";
import User from "../../models/User";
import Queue from "../../models/Queue";

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

function uniqueIds(ids: number[]): number[] {
  return [...new Set(ids.filter(id => id != null && !Number.isNaN(Number(id))))];
}

/**
 * Pending / transferência para setor / voltou a aguardar:
 * admins + fila (se houver) ou utilizadores com allTicket se fila nula.
 */
export async function resolveRecipientsForPendingOrQueue(
  companyId: number,
  queueId: number | null
): Promise<number[]> {
  const adminIds = await listAdminUserIds(companyId);
  if (queueId != null) {
    const inQueue = await listUserIdsInQueue(companyId, queueId);
    return uniqueIds([...adminIds, ...inQueue]);
  }
  const noSector = await listUserIdsAllTicketNoQueue(companyId);
  return uniqueIds([...adminIds, ...noSector]);
}

/**
 * Mensagem inbound (regra B): responsável; senão fila só; senão sem setor + admins.
 */
export async function resolveRecipientsForInboundMessage(
  companyId: number,
  ticket: {
    userId?: number | null;
    queueId?: number | null;
  }
): Promise<number[]> {
  const assigneeId = ticket.userId != null ? Number(ticket.userId) : null;
  if (assigneeId) {
    const u = await User.findOne({
      where: { id: assigneeId, companyId, ...nonSuperTenantClause },
      attributes: ["id"]
    });
    return u ? [u.id] : [];
  }

  const qid = ticket.queueId != null ? Number(ticket.queueId) : null;
  if (qid) {
    return uniqueIds(await listUserIdsInQueue(companyId, qid));
  }

  return resolveRecipientsForPendingOrQueue(companyId, null);
}
