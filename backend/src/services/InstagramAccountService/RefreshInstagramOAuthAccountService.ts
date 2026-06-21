import AppError from "../../errors/AppError";
import {
  assertMetaTokenEncryptionConfigured,
  decryptMetaToken,
  encryptMetaToken
} from "../../helpers/metaTokenCrypto";
import { sanitizeInstagramAccount } from "../../helpers/sanitizeInstagramAccount";
import InstagramAccount from "../../models/InstagramAccount";
import {
  computeInstagramOAuthRefreshMeta,
  REFRESH_FAILURE_MESSAGE,
  REFRESH_RECONNECT_HINT
} from "./instagramOAuthRefreshMeta";
import { refreshInstagramOAuthToken } from "./RefreshInstagramOAuthTokenService";
import { subscribeInstagramAccountWebhook } from "./InstagramWebhookSubscriptionService";
import { logger } from "../../utils/logger";

interface Request {
  instagramAccountId: string | number;
  companyId?: number;
  force?: boolean;
}

export interface RefreshInstagramOAuthAccountResult {
  account: ReturnType<typeof sanitizeInstagramAccount>;
  refreshed: boolean;
  skippedReason?: string;
}

const isTokenExpired = (tokenExpiresAt: Date | null): boolean =>
  Boolean(tokenExpiresAt && tokenExpiresAt.getTime() <= Date.now());

const persistRefreshFailure = async (
  account: InstagramAccount,
  errorMessage: string
): Promise<void> => {
  const expired = isTokenExpired(account.tokenExpiresAt);
  const connectionError = expired
    ? `${REFRESH_FAILURE_MESSAGE} ${REFRESH_RECONNECT_HINT}`
    : REFRESH_FAILURE_MESSAGE;

  await account.update({
    connectionError,
    ...(expired ? { status: "EXPIRED" } : {})
  });
};

const RefreshInstagramOAuthAccountService = async ({
  instagramAccountId,
  companyId,
  force = false
}: Request): Promise<RefreshInstagramOAuthAccountResult> => {
  assertMetaTokenEncryptionConfigured();

  const account = await InstagramAccount.findOne({
    where: {
      id: instagramAccountId,
      ...(companyId != null ? { companyId } : {})
    },
    include: [
      {
        association: "queues",
        attributes: ["id", "name", "color"]
      }
    ]
  });

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  const refreshMeta = computeInstagramOAuthRefreshMeta(account);

  if (!refreshMeta.canRefresh) {
    throw new AppError(
      "ERR_INSTAGRAM_OAUTH_REFRESH_NOT_ALLOWED",
      400,
      "Esta conta não pode ser renovada automaticamente. Use o login Instagram ou token manual."
    );
  }

  if (!force && !refreshMeta.refreshDue) {
    return {
      account: sanitizeInstagramAccount(account),
      refreshed: false,
      skippedReason: "not_due"
    };
  }

  logger.info(
    {
      instagramAccountId: account.id,
      companyId: account.companyId,
      force,
      refreshDue: refreshMeta.refreshDue,
      daysUntilExpiration: refreshMeta.daysUntilExpiration
    },
    "[InstagramOAuthRefresh] refresh_started"
  );

  let plainToken: string;
  try {
    plainToken = decryptMetaToken(account.pageAccessToken as string);
  } catch {
    await persistRefreshFailure(account, REFRESH_FAILURE_MESSAGE);
    throw new AppError(
      "ERR_INSTAGRAM_OAUTH_REFRESH_FAILED",
      400,
      REFRESH_FAILURE_MESSAGE
    );
  }

  try {
    const refreshed = await refreshInstagramOAuthToken(plainToken);
    const now = new Date();
    const tokenExpiresAt =
      refreshed.expiresIn > 0
        ? new Date(Date.now() + refreshed.expiresIn * 1000)
        : account.tokenExpiresAt;

    await account.update({
      status: "CONNECTED",
      pageAccessToken: encryptMetaToken(refreshed.accessToken),
      tokenExpiresAt,
      tokenRefreshedAt: now,
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
          refreshed.accessToken
        );
      } catch (err) {
        logger.warn(
          {
            instagramAccountId: account.id,
            companyId: account.companyId,
            error: err instanceof Error ? err.message : String(err)
          },
          "[InstagramOAuthRefresh] webhook_resubscribe_failed"
        );
      }
    }

    logger.info(
      {
        instagramAccountId: account.id,
        companyId: account.companyId,
        expiresIn: refreshed.expiresIn
      },
      "[InstagramOAuthRefresh] refresh_success"
    );

    return {
      account: sanitizeInstagramAccount(account),
      refreshed: true
    };
  } catch (err) {
    await persistRefreshFailure(
      account,
      err instanceof AppError ? err.clientMessage || err.message : REFRESH_FAILURE_MESSAGE
    );

    logger.warn(
      {
        instagramAccountId: account.id,
        companyId: account.companyId,
        errorCode: err instanceof AppError ? err.message : "unknown"
      },
      "[InstagramOAuthRefresh] refresh_failed"
    );

    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError(
      "ERR_INSTAGRAM_OAUTH_REFRESH_FAILED",
      400,
      REFRESH_FAILURE_MESSAGE
    );
  }
};

export default RefreshInstagramOAuthAccountService;
