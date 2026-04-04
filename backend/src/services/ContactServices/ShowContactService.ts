import Contact from "../../models/Contact";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";
import AppError from "../../errors/AppError";
import getTagsForContactIds, { ContactTagDto } from "./getTagsForContactIds";

export type CampaignListRef = { id: number; name: string };

const ShowContactService = async (
  id: string | number,
  companyId: number
): Promise<
  Record<string, unknown> & {
    tags: ContactTagDto[];
    campaignLists: CampaignListRef[];
  }
> => {
  const contact = await Contact.findByPk(id, { include: ["extraInfo", "whatsapp"] });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (contact.companyId !== companyId) {
    throw new AppError("Não é possível excluir registro de outra empresa");
  }

  const tagsMap = await getTagsForContactIds([Number(id)], companyId);
  const tags = tagsMap.get(Number(id)) ?? [];

  const listItems = await ContactListItem.findAll({
    where: { companyId, number: contact.number },
    attributes: ["id", "contactListId"],
    include: [
      {
        model: ContactList,
        attributes: ["id", "name"],
        required: true
      }
    ]
  });

  const seen = new Map<number, CampaignListRef>();
  for (const row of listItems) {
    const cl = row.contactList;
    if (cl && !seen.has(cl.id)) {
      seen.set(cl.id, { id: cl.id, name: cl.name });
    }
  }
  const campaignLists = [...seen.values()];

  return { ...contact.toJSON(), tags, campaignLists };
};

export default ShowContactService;
