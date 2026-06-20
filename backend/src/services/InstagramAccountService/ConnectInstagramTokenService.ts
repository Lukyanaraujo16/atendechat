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

  const encryptedToken = encryptMetaToken(token);
  const connectedVia =
    connection?.connectedVia ?? ("manual_token" as InstagramConnectionVia);
  const now = new Date();

  await account.update({
    status: "CONNECTED",
    pageAccessToken: encryptedToken,
    tokenExpiresAt: validation.expiresAt,
    scopes: JSON.stringify(validation.scopes),
    instagramBusinessAccountId: validation.profile.instagramBusinessAccountId,
    facebookPageId: validation.profile.facebookPageId,
    profilePicUrl: validation.profile.profilePicUrl || account.profilePicUrl,
    name: validation.profile.name || account.name,
    connectedVia,
    metaUserId: connection?.metaUserId ?? account.metaUserId,
    tokenRefreshedAt:
      connectedVia === "instagram_login" ? now : account.tokenRefreshedAt,
    connectionError: null
  });

  await account.reload({
    include: [
      {
        association: "queues",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  if (account.instagramBusinessAccountId) {
    try {
      await subscribeInstagramAccountWebhook(
        account.instagramBusinessAccountId,
        token
      );

      if (oauthFlow) {
        logger.info(
          {
            instagramAccountId: account.id,
            companyId
          },
          "[InstagramOAuth] webhook_subscribed"
        );
      }
    } catch (err) {
      logger.warn(
        {
          instagramAccountId: account.id,
          companyId,
          error: err instanceof Error ? err.message : String(err)
        },
        oauthFlow
          ? "[InstagramOAuth] failed"
          : "[InstagramWebhook] auto subscribe after connect failed"
      );
    }
  }

  return sanitizeInstagramAccount(account);
};

export default ConnectInstagramTokenService;
