import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import { FindOptions } from "sequelize/types";
import Prompt from "../../models/Prompt";
import AiAgent from "../../models/AiAgent";

const ShowWhatsAppService = async (
  id: string | number,
  companyId: number,
  session?: any
): Promise<Whatsapp> => {
  const findOptions: FindOptions = {
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage", "integrationId", "promptId"],
        include: [{ model: QueueOption, as: "options" }]
      },
      {
        model: Prompt,
        as: "prompt",
      },
      {
        model: AiAgent,
        as: "aiAgent",
        attributes: ["id", "name", "enabled"]
      }
    ],
    order: [["queues", "orderQueue", "ASC"]]
  };

  if (session !== undefined && session == 0) {
    findOptions.attributes = { exclude: ["session"] };
  }

  findOptions.where = { id, companyId };

  const whatsapp = await Whatsapp.findOne(findOptions);

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  return whatsapp;
};

export default ShowWhatsAppService;
