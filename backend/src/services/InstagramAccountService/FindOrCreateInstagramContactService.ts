import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";

interface Request {
  companyId: number;
  senderId: string;
}

export function buildInstagramContactNumber(
  companyId: number,
  senderId: string
): string {
  return `ig${companyId}_${senderId}`;
}

const FindOrCreateInstagramContactService = async ({
  companyId,
  senderId
}: Request): Promise<{ contact: Contact; created: boolean }> => {
  const number = buildInstagramContactNumber(companyId, senderId);
  const defaultName = `Instagram ${senderId}`;

  let contact = await Contact.findOne({
    where: { companyId, instagramScopedId: senderId }
  });

  if (!contact) {
    contact = await Contact.findOne({ where: { number } });
  }

  if (contact) {
    const updates: Partial<Contact> = {
      channel: "instagram",
      instagramScopedId: senderId
    };
    if (!contact.name?.trim()) {
      updates.name = defaultName;
    }
    await contact.update(updates);
    logger.info(
      { contactId: contact.id, companyId, senderId },
      "[InstagramInbound] contact_found"
    );
    return { contact, created: false };
  }

  contact = await Contact.create({
    name: defaultName,
    number,
    channel: "instagram",
    instagramScopedId: senderId,
    email: "",
    profilePicUrl: "",
    isGroup: false,
    companyId,
    whatsappId: null
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
    action: "create",
    contact
  });

  logger.info(
    { contactId: contact.id, companyId, senderId },
    "[InstagramInbound] contact_created"
  );

  return { contact, created: true };
};

export default FindOrCreateInstagramContactService;
