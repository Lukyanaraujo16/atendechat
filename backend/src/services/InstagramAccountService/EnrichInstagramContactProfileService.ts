import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import {
  buildInstagramContactDisplayName,
  fetchInstagramSenderProfile
} from "./MetaGraphApiService";
import resolveInstagramAccountToken from "./resolveInstagramAccountToken";

interface Request {
  contact: Contact;
  companyId: number;
  instagramAccountId: number;
  senderId: string;
}

const EnrichInstagramContactProfileService = async ({
  contact,
  companyId,
  instagramAccountId,
  senderId
}: Request): Promise<Contact> => {
  try {
    const { accessToken } = await resolveInstagramAccountToken(
      instagramAccountId,
      companyId
    );

    const profile = await fetchInstagramSenderProfile(senderId, accessToken);

    logger.info(
      {
        contactId: contact.id,
        senderId,
        hasName: Boolean(profile?.name),
        hasUsername: Boolean(profile?.username),
        hasProfilePic: Boolean(profile?.profilePicUrl)
      },
      "[InstagramProfile] enrichment result"
    );

    if (!profile) {
      return contact;
    }

    const displayName = buildInstagramContactDisplayName(profile, senderId);
    const updates: Partial<Contact> = {};

    const currentName = String(contact.name || "").trim();
    const isPlaceholder =
      !currentName ||
      currentName === `Instagram ${senderId}` ||
      currentName.startsWith("Instagram ");

    if (isPlaceholder && displayName) {
      updates.name = displayName;
    }

    if (profile.profilePicUrl && !contact.profilePicUrl) {
      updates.profilePicUrl = profile.profilePicUrl;
    }

    if (Object.keys(updates).length === 0) {
      return contact;
    }

    await contact.update(updates);

    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });

    logger.info(
      {
        contactId: contact.id,
        senderId,
        name: contact.name,
        hasProfilePic: Boolean(contact.profilePicUrl)
      },
      "[InstagramProfile] contact enriched"
    );

    return contact;
  } catch (err) {
    logger.warn(
      {
        contactId: contact.id,
        senderId,
        instagramAccountId,
        error: err instanceof Error ? err.message : String(err)
      },
      "[InstagramProfile] enrichment skipped"
    );
    return contact;
  }
};

export default EnrichInstagramContactProfileService;
