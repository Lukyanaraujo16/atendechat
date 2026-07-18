import { Op, Sequelize, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import sequelize from "../../database";
import ShowQueueService from "./ShowQueueService";
import { rethrowIfQueueUniqueConstraint } from "./queueUniqueErrors";
import SetCompanyUnassignedTicketsQueueService, {
  emitUnassignedTicketsQueueChanged
} from "./SetCompanyUnassignedTicketsQueueService";
import { loadCompanyUnassignedTicketsQueueId } from "../../helpers/unassignedTicketsVisibility";

interface QueueData {
  name?: string;
  color?: string;
  greetingMessage?: string;
  outOfHoursMessage?: string;
  schedules?: any[];
  chatbotDisabled?: boolean;
  orderQueue?: number;
  integrationId?: number;
  promptId?: number;
  /** Quando true, este setor passa a ser o de contingência da empresa. */
  receiveUnassignedTickets?: boolean;
}

const colorRegex = /^#[0-9a-f]{3,6}$/i;

const UpdateQueueService = async (
  queueId: number | string,
  queueData: QueueData,
  companyId: number
): Promise<Queue & { isUnassignedTicketsQueue?: boolean }> => {
  const { color, name, receiveUnassignedTickets, ...rest } = queueData;

  const queue = await ShowQueueService(queueId, companyId);

  if (queue.companyId !== companyId) {
    throw new AppError("Não é permitido alterar registros de outra empresa");
  }

  if (name !== undefined) {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new AppError("ERR_QUEUE_INVALID_NAME");
    }

    const duplicateName = await Queue.findOne({
      where: {
        companyId,
        id: { [Op.ne]: queue.id },
        [Op.and]: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("Queue.name")),
          trimmed.toLowerCase()
        )
      }
    });

    if (duplicateName) {
      throw new AppError(
        "ERR_QUEUE_DUPLICATE_NAME",
        409,
        "Já existe um setor com este nome nesta empresa."
      );
    }
  }

  if (color !== undefined) {
    if (!colorRegex.test(color)) {
      throw new AppError("ERR_QUEUE_INVALID_COLOR");
    }

    const duplicateColor = await Queue.findOne({
      where: {
        color,
        companyId,
        id: { [Op.ne]: queue.id }
      }
    });

    if (duplicateColor) {
      throw new AppError(
        "ERR_QUEUE_COLOR_ALREADY_EXISTS",
        409,
        "Esta cor já está em uso nesta empresa. Escolha outra."
      );
    }
  }

  const payload = {
    ...rest,
    ...(color !== undefined ? { color } : {}),
    ...(name !== undefined && { name: name.trim() })
  };

  let unassignedTicketsQueueId: number | null =
    await loadCompanyUnassignedTicketsQueueId(companyId);

  await sequelize.transaction(async (transaction: Transaction) => {
    try {
      await queue.update(payload, { transaction });
    } catch (err) {
      rethrowIfQueueUniqueConstraint(err);
    }

    if (receiveUnassignedTickets !== undefined) {
      if (receiveUnassignedTickets === true) {
        unassignedTicketsQueueId =
          await SetCompanyUnassignedTicketsQueueService({
            companyId,
            queueId: Number(queue.id),
            transaction
          });
      } else if (Number(unassignedTicketsQueueId) === Number(queue.id)) {
        unassignedTicketsQueueId =
          await SetCompanyUnassignedTicketsQueueService({
            companyId,
            queueId: null,
            transaction
          });
      }
    }
  });

  await queue.reload();

  if (receiveUnassignedTickets !== undefined) {
    await emitUnassignedTicketsQueueChanged(
      companyId,
      unassignedTicketsQueueId
    );
  }

  const plain = queue.toJSON() as Queue & {
    isUnassignedTicketsQueue?: boolean;
  };
  (plain as any).isUnassignedTicketsQueue =
    Number(unassignedTicketsQueueId) === Number(queue.id);

  return plain as Queue & { isUnassignedTicketsQueue?: boolean };
};

export default UpdateQueueService;
