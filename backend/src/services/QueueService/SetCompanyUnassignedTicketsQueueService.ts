import { Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Queue from "../../models/Queue";
import { getIO } from "../../libs/socket";
import { syncCompanyNullQueueSocketRooms } from "../../libs/syncCompanyNullQueueSocketRooms";

type Request = {
  companyId: number;
  queueId: number | null;
  transaction?: Transaction;
};

/**
 * Define (ou limpa) o setor de contingência para tickets sem queueId.
 * Unicidade por empresa via FK única em Companies.unassignedTicketsQueueId.
 */
const SetCompanyUnassignedTicketsQueueService = async ({
  companyId,
  queueId,
  transaction
}: Request): Promise<number | null> => {
  const company = await Company.findByPk(companyId, {
    attributes: ["id", "unassignedTicketsQueueId"],
    transaction
  });

  if (!company) {
    throw new AppError("ERR_NO_PERMISSION_TO_CONFIGURE_UNASSIGNED_QUEUE", 403);
  }

  if (queueId == null) {
    await company.update({ unassignedTicketsQueueId: null }, { transaction });
    return null;
  }

  const qid = Number(queueId);
  if (!Number.isFinite(qid)) {
    throw new AppError("ERR_UNASSIGNED_TICKETS_QUEUE_NOT_FOUND", 404);
  }

  const queue = await Queue.findByPk(qid, {
    attributes: ["id", "companyId"],
    transaction
  });

  if (!queue) {
    throw new AppError("ERR_UNASSIGNED_TICKETS_QUEUE_NOT_FOUND", 404);
  }

  if (Number(queue.companyId) !== Number(companyId)) {
    throw new AppError("ERR_UNASSIGNED_TICKETS_QUEUE_INVALID_COMPANY", 403);
  }

  await company.update({ unassignedTicketsQueueId: qid }, { transaction });
  return qid;
};

export async function emitUnassignedTicketsQueueChanged(
  companyId: number,
  unassignedTicketsQueueId: number | null
): Promise<void> {
  try {
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(
      `company-${companyId}-unassignedTicketsQueue`,
      {
        action: "update",
        companyId,
        unassignedTicketsQueueId
      }
    );
  } catch {
    // socket pode não estar inicializado em testes
  }

  try {
    await syncCompanyNullQueueSocketRooms(companyId, unassignedTicketsQueueId);
  } catch {
    // fail-open: clientes ainda podem rejoin via evento
  }
}

export default SetCompanyUnassignedTicketsQueueService;
