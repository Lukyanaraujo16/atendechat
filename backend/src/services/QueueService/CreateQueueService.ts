import * as Yup from "yup";
import { Op, Sequelize, Transaction } from "sequelize";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Plan from "../../models/Plan";
import sequelize from "../../database";
import { rethrowIfQueueUniqueConstraint } from "./queueUniqueErrors";
import SetCompanyUnassignedTicketsQueueService, {
  emitUnassignedTicketsQueueChanged
} from "./SetCompanyUnassignedTicketsQueueService";

interface QueueData {
  name: string;
  color: string;
  companyId: number;
  greetingMessage?: string;
  outOfHoursMessage?: string;
  schedules?: any[];
  chatbotDisabled?: boolean;
  orderQueue?: number;
  integrationId?: number;
  promptId?: number;
  receiveUnassignedTickets?: boolean;
}

const CreateQueueService = async (
  queueData: QueueData
): Promise<Queue & { isUnassignedTicketsQueue?: boolean }> => {
  const { color, name, companyId, receiveUnassignedTickets, ...rest } =
    queueData;

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

  let created: Queue;
  let unassignedTicketsQueueId: number | null =
    company?.unassignedTicketsQueueId != null
      ? Number(company.unassignedTicketsQueueId)
      : null;

  try {
    await sequelize.transaction(async (transaction: Transaction) => {
      created = await Queue.create(
        {
          ...rest,
          color,
          companyId,
          name: trimmed
        },
        { transaction }
      );

      if (receiveUnassignedTickets === true) {
        unassignedTicketsQueueId =
          await SetCompanyUnassignedTicketsQueueService({
            companyId,
            queueId: Number(created.id),
            transaction
          });
      }
    });
  } catch (err) {
    rethrowIfQueueUniqueConstraint(err);
  }

  if (receiveUnassignedTickets === true) {
    await emitUnassignedTicketsQueueChanged(
      companyId,
      unassignedTicketsQueueId
    );
  }

  const plain = created!.toJSON() as Queue & {
    isUnassignedTicketsQueue?: boolean;
  };
  (plain as any).isUnassignedTicketsQueue =
    Number(unassignedTicketsQueueId) === Number(created!.id);

  return plain as Queue & { isUnassignedTicketsQueue?: boolean };
};

export default CreateQueueService;
