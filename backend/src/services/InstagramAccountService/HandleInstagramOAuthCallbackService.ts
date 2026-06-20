import AppError from "../../errors/AppError";
import {
  buildInstagramOAuthRedirectUrl,
  INSTAGRAM_OAUTH_ERROR_MESSAGES
} from "../../helpers/instagramOAuthRedirect";
import { verifyMetaOAuthState } from "../../helpers/metaOAuthState";
import { getIO } from "../../libs/socket";
import InstagramAccount from "../../models/InstagramAccount";
import ConnectInstagramTokenService from "./ConnectInstagramTokenService";
import {
  exchangeInstagramLongLivedToken,
  exchangeInstagramOAuthCode
} from "./ExchangeInstagramOAuthCodeService";
import {
  InstagramTokenValidationResult,
  validateInstagramAccessToken
} from "./MetaGraphApiService";
import { logger } from "../../utils/logger";

interface Request {
  code?: string;
  state?: string;
  oauthError?: string;
  oauthErrorDescription?: string;
}

const mapErrorToRedirectReason = (err: unknown): string => {
  if (err instanceof AppError) {
    if (err.message === "ERR_META_OAUTH_STATE_EXPIRED") {
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.EXPIRED;
    }
    if (err.message === "ERR_META_OAUTH_STATE_INVALID") {
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.INVALID_STATE;
    }
    if (err.message === "ERR_INSTAGRAM_TOKEN_MISSING_SCOPES") {
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.MISSING_SCOPES;
    }
    if (
      err.message === "ERR_INSTAGRAM_NOT_ELIGIBLE" ||
      err.message === "ERR_INSTAGRAM_TOKEN_INVALID"
    ) {
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.NOT_BUSINESS;
    }
    if (err.clientMessage) {
      return err.clientMessage;
    }
  }

  return INSTAGRAM_OAUTH_ERROR_MESSAGES.CONNECTION_FAILED;
};

const persistConnectionError = async (
  instagramAccountId: number,
  companyId: number,
  reason: string
): Promise<void> => {
  try {
    await InstagramAccount.update(
      { connectionError: reason },
      { where: { id: instagramAccountId, companyId } }
    );
  } catch {
    // best-effort — não bloqueia redirect
  }
};

const HandleInstagramOAuthCallbackService = async ({
  code,
  state,
  oauthError,
  oauthErrorDescription
}: Request): Promise<string> => {
  logger.info("[InstagramOAuth] callback_received");

  if (oauthError) {
    const reason =
      oauthError === "access_denied"
        ? INSTAGRAM_OAUTH_ERROR_MESSAGES.USER_DENIED
        : oauthErrorDescription?.trim() ||
          INSTAGRAM_OAUTH_ERROR_MESSAGES.CONNECTION_FAILED;

    logger.warn(
      { oauthError },
      "[InstagramOAuth] failed"
    );

    return buildInstagramOAuthRedirectUrl({ success: false, reason });
  }

  if (!code?.trim()) {
    logger.warn("[InstagramOAuth] failed");
    return buildInstagramOAuthRedirectUrl({
      success: false,
      reason: INSTAGRAM_OAUTH_ERROR_MESSAGES.NO_CODE
    });
  }

  let companyId: number | undefined;
  let instagramAccountId: number | undefined;

  try {
    const statePayload = verifyMetaOAuthState(state || "");
    companyId = statePayload.companyId;
    instagramAccountId = statePayload.instagramAccountId;

    const account = await InstagramAccount.findOne({
      where: {
        id: statePayload.instagramAccountId,
        companyId: statePayload.companyId
      }
    });

    if (!account) {
      throw new AppError(
        "ERR_NO_INSTAGRAM_ACCOUNT_FOUND",
        404,
        INSTAGRAM_OAUTH_ERROR_MESSAGES.CONNECTION_FAILED
      );
    }

    const shortLived = await exchangeInstagramOAuthCode(code);
    const longLived = await exchangeInstagramLongLivedToken(shortLived.accessToken);

    let validation: InstagramTokenValidationResult;
    try {
      validation = await validateInstagramAccessToken(longLived.accessToken);
      logger.info(
        {
          instagramAccountId: account.id,
          companyId: statePayload.companyId,
          validatedVia: validation.validatedVia
        },
        "[InstagramOAuth] token_validated"
      );
    } catch (validationErr) {
      throw validationErr;
    }

    if (!validation.profile.instagramBusinessAccountId) {
      throw new AppError(
        "ERR_INSTAGRAM_NOT_ELIGIBLE",
        400,
        INSTAGRAM_OAUTH_ERROR_MESSAGES.NOT_BUSINESS
      );
    }

    const tokenExpiresAt =
      longLived.expiresIn > 0
        ? new Date(Date.now() + longLived.expiresIn * 1000)
        : validation.expiresAt;

    const connectedAccount = await ConnectInstagramTokenService({
      instagramAccountId: String(account.id),
      companyId: statePayload.companyId,
      accessToken: longLived.accessToken,
      prevalidated: {
        ...validation,
        expiresAt: tokenExpiresAt
      },
      connection: {
        connectedVia: "instagram_login",
        metaUserId: shortLived.userId || null
      },
      oauthFlow: true
    });

    const io = getIO();
    io.to(`company-${statePayload.companyId}-mainchannel`).emit(
      `company-${statePayload.companyId}-instagramAccount`,
      {
        action: "update",
        instagramAccount: connectedAccount
      }
    );

    logger.info(
      {
        instagramAccountId: account.id,
        companyId: statePayload.companyId
      },
      "[InstagramOAuth] account_connected"
    );

    return buildInstagramOAuthRedirectUrl({
      success: true,
      accountId: account.id
    });
  } catch (err) {
    const reason = mapErrorToRedirectReason(err);

    logger.warn(
      {
        instagramAccountId,
        companyId,
        errorCode: err instanceof AppError ? err.message : "unknown"
      },
      "[InstagramOAuth] failed"
    );

    if (instagramAccountId != null && companyId != null) {
      await persistConnectionError(instagramAccountId, companyId, reason);
    }

    return buildInstagramOAuthRedirectUrl({ success: false, reason });
  }
};

export default HandleInstagramOAuthCallbackService;
