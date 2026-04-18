import { Op, Sequelize } from "sequelize";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import ShowQueueService from "./ShowQueueService";
import { rethrowIfQueueUniqueConstraint } from "./queueUniqueErrors";

interface QueueData {
  name?: string;
  color?: string;
  greetingMessage?: string;
  outOfHoursMessage?: string;
  schedules?: any[];
  orderQueue?: number;
  integrationId?: number;
  promptId?: number;
}

const colorRegex = /^#[0-9a-f]{3,6}$/i;

const UpdateQueueService = async (
  queueId: number | string,
  queueData: QueueData,
  companyId: number
): Promise<Queue> => {
  const { color, name } = queueData;

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
    ...queueData,
    ...(name !== undefined && { name: name.trim() })
  };

  try {
    await queue.update(payload);
  } catch (err) {
    rethrowIfQueueUniqueConstraint(err);
  }

  return queue;
};

export default UpdateQueueService;
