import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

const AssociateWhatsappQueue = async (
  whatsapp: Whatsapp,
  queueIds: number[]
): Promise<void> => {
  if (!queueIds.length) {
    await whatsapp.$set("queues", []);
    await whatsapp.reload();
    return;
  }

  const valid = await Queue.count({
    where: {
      id: { [Op.in]: queueIds },
      companyId: whatsapp.companyId
    }
  });

  if (valid !== queueIds.length) {
    throw new AppError(
      "ERR_QUEUE_INVALID_OR_OTHER_COMPANY",
      403,
      "Um ou mais setores não pertencem a esta empresa."
    );
  }

  await whatsapp.$set("queues", queueIds);

  await whatsapp.reload();
};

export default AssociateWhatsappQueue;
