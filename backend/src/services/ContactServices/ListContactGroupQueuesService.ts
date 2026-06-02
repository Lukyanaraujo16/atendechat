import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import { loadAuthorizedQueuesForContact } from "../../helpers/groupVisibility";

const ListContactGroupQueuesService = async (
  contactId: number,
  companyId: number
): Promise<{ queueIds: number[]; queues: Array<{ id: number; name: string; color: string }> }> => {
  const contact = await Contact.findOne({
    where: { id: contactId, companyId, isGroup: true },
    attributes: ["id", "companyId", "isGroup"]
  });
  if (!contact) {
    throw new AppError("ERR_CONTACT_NOT_GROUP", 400);
  }

  const queues = await loadAuthorizedQueuesForContact(contactId, companyId);
  return {
    queueIds: queues.map((q) => q.id),
    queues: queues.map((q) => ({
      id: q.id,
      name: q.name,
      color: q.color
    }))
  };
};

export default ListContactGroupQueuesService;
