import { Op } from "sequelize";
import Contact from "../../models/Contact";
import Queue from "../../models/Queue";
import ContactQueueVisibility from "../../models/ContactQueueVisibility";
import AppError from "../../errors/AppError";

const UpdateContactGroupQueuesService = async ({
  contactId,
  companyId,
  queueIds
}: {
  contactId: number;
  companyId: number;
  queueIds: number[];
}): Promise<{ queueIds: number[] }> => {
  const contact = await Contact.findOne({
    where: { id: contactId, companyId, isGroup: true },
    attributes: ["id", "companyId", "isGroup"]
  });
  if (!contact) {
    throw new AppError("ERR_CONTACT_NOT_GROUP", 400);
  }

  const uniqueIds = [...new Set(queueIds.map((id) => Number(id)).filter(Number.isFinite))];

  if (uniqueIds.length > 0) {
    const validQueues = await Queue.findAll({
      where: { companyId, id: { [Op.in]: uniqueIds } },
      attributes: ["id"]
    });
    if (validQueues.length !== uniqueIds.length) {
      throw new AppError("ERR_INVALID_QUEUE_IDS", 400);
    }
  }

  await ContactQueueVisibility.destroy({
    where: { companyId, contactId }
  });

  if (uniqueIds.length > 0) {
    await ContactQueueVisibility.bulkCreate(
      uniqueIds.map((queueId) => ({
        companyId,
        contactId,
        queueId
      }))
    );
  }

  return { queueIds: uniqueIds };
};

export default UpdateContactGroupQueuesService;
