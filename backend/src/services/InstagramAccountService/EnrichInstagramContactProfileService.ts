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

type PlannedUpdates = {
  name?: string;
  profilePicUrl?: string;
};

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

const summarizeUpdates = (updates: PlannedUpdates): Record<string, unknown> => ({
  fields: Object.keys(updates),
  name: updates.name ?? null,
  profilePicUrlLength: updates.profilePicUrl?.length ?? 0
});

const applyContactFieldUpdates = async ({
  contact,
  companyId,
  senderId,
  updates
}: {
  contact: Contact;
  companyId: number;
  senderId: string;
  updates: PlannedUpdates;
}): Promise<{ applied: string[]; failed: Array<{ field: string; error: string }> }> => {
  logger.info(
    {
      senderId,
      contactId: contact.id,
      beforeName: contact.name,
      beforeHasProfilePic: Boolean(contact.profilePicUrl),
      plannedUpdates: summarizeUpdates(updates)
    },
    "[InstagramProfile] applying_updates"
  );

  const applied: string[] = [];
  const failed: Array<{ field: string; error: string }> = [];

  if (updates.name) {
    try {
      await contact.update({ name: updates.name });
      applied.push("name");
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failed.push({ field: "name", error });
      logger.warn(
        { senderId, contactId: contact.id, field: "name", error },
        "[InstagramProfile] field_update_failed"
      );
    }
  }

  if (updates.profilePicUrl) {
    try {
      await contact.update({ profilePicUrl: updates.profilePicUrl });
      applied.push("profilePicUrl");
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failed.push({ field: "profilePicUrl", error });
      logger.warn(
        {
          senderId,
          contactId: contact.id,
          field: "profilePicUrl",
          profilePicUrlLength: updates.profilePicUrl.length,
          error
        },
        "[InstagramProfile] field_update_failed"
      );
    }
  }

  if (applied.length > 0) {
    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-contact`, {
      action: "update",
      contact
    });

    logger.info(
      {
        senderId,
        contactId: contact.id,
        appliedUpdates: applied,
        failedUpdates: failed.map((item) => item.field),
        afterName: contact.name,
        afterHasProfilePic: Boolean(contact.profilePicUrl)
      },
      "[InstagramProfile] contact_updated"
    );
  }

  if (failed.length > 0 && applied.length > 0) {
    logger.info(
      {
        senderId,
        contactId: contact.id,
        appliedUpdates: applied,
        failed
      },
      "[InstagramProfile] contact_partially_updated"
    );
  }

  return { applied, failed };
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
    const updates: PlannedUpdates = {};
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

    const { applied, failed } = await applyContactFieldUpdates({
      contact,
      companyId,
      senderId,
      updates
    });

    if (applied.length === 0 && failed.length > 0) {
      logEnrichmentSkipped(senderId, "field_update_failed", {
        contactId: contact.id,
        failed
      });
    }

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
