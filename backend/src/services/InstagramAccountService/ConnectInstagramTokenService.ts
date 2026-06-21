import AppError from "../../errors/AppError";
import {
  assertMetaTokenEncryptionConfigured,
  encryptMetaToken
} from "../../helpers/metaTokenCrypto";
import { sanitizeInstagramAccount } from "../../helpers/sanitizeInstagramAccount";
import InstagramAccount from "../../models/InstagramAccount";
import {
  InstagramTokenValidationResult,
  validateInstagramAccessToken
} from "./MetaGraphApiService";
import { subscribeInstagramAccountWebhook } from "./InstagramWebhookSubscriptionService";
import {
  clearDuplicateOAuthStarterAccount,
  resolveInstagramAccountDuplicate
} from "./resolveInstagramAccountDuplicate";
import { logger } from "../../utils/logger";

type InstagramConnectionVia = "manual_token" | "instagram_login" | "facebook_page";

interface Request {
  instagramAccountId: string;
  companyId: number;
  accessToken: string;
  prevalidated?: InstagramTokenValidationResult;
  connection?: {
    connectedVia?: InstagramConnectionVia;
    metaUserId?: string | null;
  };
  oauthFlow?: boolean;
}

const ConnectInstagramTokenService = async ({
  instagramAccountId,
  companyId,
  accessToken,
  prevalidated,
  connection,
  oauthFlow = false
}: Request) => {
  const token = accessToken?.trim();
  if (!token) {
    throw new AppError(
      "ERR_INSTAGRAM_TOKEN_INVALID",
      400,
      "Informe um token de acesso válido."
    );
  }

  assertMetaTokenEncryptionConfigured();

  const account = await InstagramAccount.findOne({
    where: { id: instagramAccountId, companyId }
  });

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  const validation =
    prevalidated ?? (await validateInstagramAccessToken(token));

  const businessAccountId = validation.profile.instagramBusinessAccountId;
  let duplicateStarterAccountId: number | null = null;
  let targetAccount = account;

  if (businessAccountId) {
    const resolved = await resolveInstagramAccountDuplicate({
      companyId,
      requestedAccountId: account.id,
      instagramBusinessAccountId: businessAccountId,
      oauthFlow
    });

    if (resolved.upgraded) {
      duplicateStarterAccountId = resolved.duplicateStarterAccountId;

      if (duplicateStarterAccountId != null) {
        await clearDuplicateOAuthStarterAccount(
          duplicateStarterAccountId,
          companyId
        );
      }

      if (resolved.targetAccountId !== account.id) {
        const existingAccount = await InstagramAccount.findOne({
          where: { id: resolved.targetAccountId, companyId }
        });

        if (!existingAccount) {
          throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
        }

        targetAccount = existingAccount;
      }
    }
  }

  const encryptedToken = encryptMetaToken(token);
  const connectedVia =
    connection?.connectedVia ?? ("manual_token" as InstagramConnectionVia);
  const now = new Date();

  await targetAccount.update({
    status: "CONNECTED",
    pageAccessToken: encryptedToken,
    tokenExpiresAt: validation.expiresAt,
    scopes: JSON.stringify(validation.scopes),
    instagramBusinessAccountId: validation.profile.instagramBusinessAccountId,
    facebookPageId: validation.profile.facebookPageId,
    profilePicUrl: validation.profile.profilePicUrl || targetAccount.profilePicUrl,
    name: validation.profile.name || targetAccount.name,
    connectedVia,
    metaUserId: connection?.metaUserId ?? targetAccount.metaUserId,
    tokenRefreshedAt:
      connectedVia === "instagram_login" ? now : targetAccount.tokenRefreshedAt,
    connectionError: null
  });

  await targetAccount.reload({
    include: [
      {
        association: "queues",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  if (targetAccount.instagramBusinessAccountId) {
    try {
      await subscribeInstagramAccountWebhook(
        targetAccount.instagramBusinessAccountId,
        token
      );

      if (oauthFlow) {
        logger.info(
          {
            instagramAccountId: targetAccount.id,
            companyId,
            duplicateStarterAccountId
          },
          "[InstagramOAuth] webhook_subscribed"
        );
      }
    } catch (err) {
      logger.warn(
        {
          instagramAccountId: targetAccount.id,
          companyId,
          error: err instanceof Error ? err.message : String(err)
        },
        oauthFlow
          ? "[InstagramOAuth] failed"
          : "[InstagramWebhook] auto subscribe after connect failed"
      );
    }
  }

  return sanitizeInstagramAccount(targetAccount);
};

export default ConnectInstagramTokenService;
