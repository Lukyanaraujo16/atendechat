import * as Yup from "yup";
import { Op, Sequelize } from "sequelize";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import { rethrowIfQueueUniqueConstraint } from "./queueUniqueErrors";

interface QueueData {
  name: string;
  color: string;
  companyId: number;
  greetingMessage?: string;
  outOfHoursMessage?: string;
  schedules?: any[];
  orderQueue?: number;
  integrationId?: number;
  promptId?: number;
}

const CreateQueueService = async (queueData: QueueData): Promise<Queue> => {
  const { color, name, companyId } = queueData;

  const company = await Company.findOne({
    where: {
      id: companyId
    },
    include: [{ model: Plan, as: "plan" }]
  });

  if (company !== null) {
    const queuesCount = await Queue.count({
      where: {
        companyId
      }
    });

    if (queuesCount >= company.plan.queues) {
      throw new AppError(`Número máximo de filas já alcançado: ${queuesCount}`);
    }
  }

  const queueSchema = Yup.object().shape({
    name: Yup.string()
      .min(2, "ERR_QUEUE_INVALID_NAME")
      .required("ERR_QUEUE_INVALID_NAME"),
    color: Yup.string()
      .required("ERR_QUEUE_INVALID_COLOR")
      .test("Check-color", "ERR_QUEUE_INVALID_COLOR", async value => {
        if (value) {
          const colorTestRegex = /^#[0-9a-f]{3,6}$/i;
          return colorTestRegex.test(value);
        }
        return false;
      })
      .test(
        "Check-color-exists",
        "ERR_QUEUE_COLOR_ALREADY_EXISTS",
        async value => {
          if (value) {
            const queueWithSameColor = await Queue.findOne({
              where: { color: value, companyId }
            });
            return !queueWithSameColor;
          }
          return false;
        }
      )
  });

  try {
    await queueSchema.validate({ color, name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const trimmed = name.trim();

  const duplicateName = await Queue.findOne({
    where: {
      companyId,
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

  try {
    const queue = await Queue.create({
      ...queueData,
      name: trimmed
    });
    return queue;
  } catch (err) {
    rethrowIfQueueUniqueConstraint(err);
  }
};

export default CreateQueueService;
