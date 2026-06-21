import AppError from "../../errors/AppError";
import { createMetaOAuthState } from "../../helpers/metaOAuthState";
import {
  getMissingMetaOAuthStartKeys,
  logMetaOAuthConfigCheck,
  logMetaOAuthConfigMissing
} from "../../helpers/metaOAuthConfigCheck";
import InstagramAccount from "../../models/InstagramAccount";
import { REQUIRED_INSTAGRAM_SCOPES } from "./MetaGraphApiService";
import { logger } from "../../utils/logger";

interface Request {
  instagramAccountId: string;
  companyId: number;
  userId: string;
}

const parseOAuthScopes = (): string[] => {
  const raw = process.env.META_INSTAGRAM_OAUTH_SCOPES?.trim();
  if (!raw) {
    return [...REQUIRED_INSTAGRAM_SCOPES];
  }

  const scopes = raw
    .split(",")
    .map(scope => scope.trim())
    .filter(Boolean);

  return scopes.length ? scopes : [...REQUIRED_INSTAGRAM_SCOPES];
};

/**
 * Authorization URL — Instagram Login API.
 * GET https://www.instagram.com/oauth/authorize
 */
const INSTAGRAM_OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";

const StartInstagramOAuthService = async ({
  instagramAccountId,
  companyId,
  userId
}: Request): Promise<{ authorizationUrl: string }> => {
  const configFlags = logMetaOAuthConfigCheck("StartInstagramOAuthService", {
    phase: "oauth_start"
  });
  const missingKeys = getMissingMetaOAuthStartKeys(configFlags);

  const appId = process.env.META_APP_ID?.trim();
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim();

  if (!appId || !redirectUri || !process.env.META_APP_SECRET?.trim()) {
    logMetaOAuthConfigMissing("StartInstagramOAuthService", missingKeys);
    throw new AppError(
      "ERR_META_APP_CONFIG_MISSING",
      500,
      "Configuração Meta incompleta no servidor."
    );
  }

  const account = await InstagramAccount.findOne({
    where: { id: instagramAccountId, companyId }
  });

  if (!account) {
    throw new AppError("ERR_NO_INSTAGRAM_ACCOUNT_FOUND", 404);
  }

  logger.info(
    {
      instagramAccountId: account.id,
      companyId
    },
    "[InstagramOAuth] start"
  );

  const state = createMetaOAuthState({
    companyId,
    instagramAccountId: account.id,
    userId
  });

  logger.info(
    {
      instagramAccountId: account.id,
      companyId
    },
    "[InstagramOAuth] state_created"
  );

  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    scope: parseOAuthScopes().join(","),
    response_type: "code",
    state
  });

  return {
    authorizationUrl: `${INSTAGRAM_OAUTH_AUTHORIZE_URL}?${params.toString()}`
  };
};

export default StartInstagramOAuthService;
