import { getIO } from "../../libs/socket";
import Contact from "../../models/Contact";
import { logger } from "../../utils/logger";
import {
  buildInstagramContactDisplayName,
  lookupInstagramSenderProfile
} from "./MetaGraphApiService";
import resolveInstagramAccountToken from "./resolveInstagramAccountToken";

interface Request {
  contact: Contact;
  companyId: number;
  instagramAccountId: number;
  senderId: string;
}

const logEnrichmentSkipped = (
  senderId: string,
  reason: string,
  extra: Record<string, unknown> = {}
): void => {
  logger.info(
    { senderId, reason, ...extra },
    "[InstagramProfile] enrichment_skipped"
  );
};

const EnrichInstagramContactProfileService = async ({
  contact,
  companyId,
  instagramAccountId,
  senderId
}: Request): Promise<Contact> => {
  let instagramBusinessAccountId: string | null = null;

  try {
    const { account, accessToken } = await resolveInstagramAccountToken(
      instagramAccountId,
      companyId
    );
    instagramBusinessAccountId = account.instagramBusinessAccountId ?? null;

    logger.info(
      {
        senderId,
        instagramBusinessAccountId,
        contactId: contact.id,
        instagramAccountId
      },
      "[InstagramProfile] lookup_started"
    );

    const lookup = await lookupInstagramSenderProfile(senderId, accessToken);

    if (lookup.ok === false) {
      logger.warn(
        {
          senderId,
          instagramBusinessAccountId,
          error: lookup.error,
          statusCode: lookup.statusCode,
          metaErrorCode: lookup.metaErrorCode,
          rawResponse: lookup.rawResponse
        },
        "[InstagramProfile] lookup_failed"
      );
      logEnrichmentSkipped(senderId, "graph_lookup_failed", {
        contactId: contact.id,
        statusCode: lookup.statusCode
      });
      return contact;
    }

    logger.info(
      {
        senderId,
        instagramBusinessAccountId,
        rawResponse: lookup.rawResponse
      },
      "[InstagramProfile] graph_response"
    );

    const { profile } = lookup;

    logger.info(
      {
        senderId,
        name: profile.name,
        username: profile.username,
        profilePic: profile.profilePicUrl,
        hasName: Boolean(profile.name),
        hasUsername: Boolean(profile.username),
        hasProfilePic: Boolean(profile.profilePicUrl)
      },
      "[InstagramProfile] enrichment_result"
    );

    if (!profile.name && !profile.username && !profile.profilePicUrl) {
      logEnrichmentSkipped(senderId, "empty_profile_fields", {
        contactId: contact.id
      });
      return contact;
    }

    const displayName = buildInstagramContactDisplayName(profile, senderId);
    const updates: Partial<Contact> = {};
    const skipReasons: string[] = [];

    const currentName = String(contact.name || "").trim();
    const isPlaceholder =
      !currentName ||
      currentName === `Instagram ${senderId}` ||
      currentName.startsWith("Instagram ");

    if (isPlaceholder && displayName) {
      updates.name = displayName;
    } else if (profile.name || profile.username) {
      skipReasons.push("name_not_placeholder");
    }

    if (profile.profilePicUrl && !contact.profilePicUrl) {
      updates.profilePicUrl = profile.profilePicUrl;
    } else if (profile.profilePicUrl && contact.profilePicUrl) {
      skipReasons.push("profile_pic_already_set");
    }

    if (Object.keys(updates).length === 0) {
      logEnrichmentSkipped(
        senderId,
        skipReasons.length > 0 ? skipReasons.join(",") : "no_updatable_fields",
        {
          contactId: contact.id,
          currentName,
          displayName,
          hasExistingProfilePic: Boolean(contact.profilePicUrl)
        }
      );
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
        senderId,
        contactId: contact.id,
        appliedUpdates: Object.keys(updates),
        name: contact.name,
        hasProfilePic: Boolean(contact.profilePicUrl)
      },
      "[InstagramProfile] contact_updated"
    );

    return contact;
  } catch (err) {
    logger.warn(
      {
        senderId,
        instagramBusinessAccountId,
        contactId: contact.id,
        instagramAccountId,
        error: err instanceof Error ? err.message : String(err)
      },
      "[InstagramProfile] lookup_failed"
    );

    const reason =
      err instanceof Error && err.message.includes("token")
        ? "token_resolution_failed"
        : "unexpected_error";

    logEnrichmentSkipped(senderId, reason, {
      contactId: contact.id,
      instagramAccountId
    });

    return contact;
  }
};

export default EnrichInstagramContactProfileService;
