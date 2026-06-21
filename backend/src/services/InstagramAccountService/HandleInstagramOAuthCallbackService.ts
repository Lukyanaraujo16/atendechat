import AppError from "../../errors/AppError";
import {
  buildInstagramOAuthRedirectUrl,
  INSTAGRAM_OAUTH_REASON_CODES,
  oauthReasonCodeToMessage
} from "../../helpers/instagramOAuthRedirect";
import { verifyMetaOAuthState } from "../../helpers/metaOAuthState";
import { sanitizeInstagramAccount } from "../../helpers/sanitizeInstagramAccount";
import { getIO } from "../../libs/socket";
import InstagramAccount from "../../models/InstagramAccount";
import ConnectInstagramTokenService from "./ConnectInstagramTokenService";
import ShowInstagramAccountService from "./ShowInstagramAccountService";
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
      return INSTAGRAM_OAUTH_REASON_CODES.EXPIRED;
    }
    if (err.message === "ERR_META_OAUTH_STATE_INVALID") {
      return INSTAGRAM_OAUTH_REASON_CODES.INVALID_STATE;
    }
    if (err.message === "ERR_INSTAGRAM_TOKEN_MISSING_SCOPES") {
      return INSTAGRAM_OAUTH_REASON_CODES.MISSING_SCOPES;
    }
    if (
      err.message === "ERR_INSTAGRAM_NOT_ELIGIBLE" ||
      err.message === "ERR_INSTAGRAM_TOKEN_INVALID"
    ) {
      return INSTAGRAM_OAUTH_REASON_CODES.NOT_BUSINESS;
    }
    if (err.message === "ERR_INSTAGRAM_ACCOUNT_DUPLICATE") {
      return INSTAGRAM_OAUTH_REASON_CODES.DUPLICATE_ACCOUNT;
    }
  }

  return INSTAGRAM_OAUTH_REASON_CODES.CONNECTION_FAILED;
};

const persistConnectionError = async (
  instagramAccountId: number,
  companyId: number,
  reasonCode: string
): Promise<void> => {
  try {
    await InstagramAccount.update(
      { connectionError: oauthReasonCodeToMessage(reasonCode) },
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
        ? INSTAGRAM_OAUTH_REASON_CODES.USER_DENIED
        : INSTAGRAM_OAUTH_REASON_CODES.CONNECTION_FAILED;

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
      reason: INSTAGRAM_OAUTH_REASON_CODES.NO_CODE
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
      throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
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
      throw new AppError("ERR_INSTAGRAM_NOT_ELIGIBLE", 400);
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

    if (Number(connectedAccount.id) !== account.id) {
      const clearedStarter = await ShowInstagramAccountService(
        String(account.id),
        statePayload.companyId
      );
      io.to(`company-${statePayload.companyId}-mainchannel`).emit(
        `company-${statePayload.companyId}-instagramAccount`,
        {
          action: "update",
          instagramAccount: sanitizeInstagramAccount(clearedStarter)
        }
      );
    }

    logger.info(
      {
        instagramAccountId: connectedAccount.id,
        oauthStarterAccountId: account.id,
        companyId: statePayload.companyId,
        upgradedExisting:
          Number(connectedAccount.id) !== account.id
      },
      "[InstagramOAuth] account_connected"
    );

    return buildInstagramOAuthRedirectUrl({
      success: true,
      accountId: Number(connectedAccount.id)
    });
  } catch (err) {
    const reason = mapErrorToRedirectReason(err);

    logger.warn(
      {
        instagramAccountId,
        companyId,
        errorCode: err instanceof AppError ? err.message : "unknown",
        failReason:
          err instanceof AppError && err.message === "ERR_META_OAUTH_STATE_INVALID"
            ? "state_invalid"
            : err instanceof AppError && err.message === "ERR_META_OAUTH_STATE_EXPIRED"
              ? "state_expired"
              : undefined
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
