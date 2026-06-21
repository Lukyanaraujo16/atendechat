import { logger } from "../utils/logger";

export type MetaOAuthConfigSource =
  | "StartInstagramOAuthService"
  | "metaOAuthState"
  | "ExchangeInstagramOAuthCodeService"
  | "MetaGraphApiService"
  | "MetaWebhookController";

export interface MetaOAuthConfigFlags {
  hasMetaAppId: boolean;
  hasMetaAppSecret: boolean;
  hasRedirectUri: boolean;
  hasEncryptionKey: boolean;
  hasFrontendUrl: boolean;
}

const isSet = (value: string | undefined): boolean => Boolean(value?.trim());

export const getMetaOAuthConfigFlags = (): MetaOAuthConfigFlags => ({
  hasMetaAppId: isSet(process.env.META_APP_ID),
  hasMetaAppSecret: isSet(process.env.META_APP_SECRET),
  hasRedirectUri: isSet(process.env.META_OAUTH_REDIRECT_URI),
  hasEncryptionKey:
    isSet(process.env.META_TOKEN_ENCRYPTION_KEY) || isSet(process.env.META_APP_SECRET),
  hasFrontendUrl: isSet(process.env.FRONTEND_URL)
});

export const getMissingMetaOAuthStartKeys = (
  flags: MetaOAuthConfigFlags
): string[] => {
  const missing: string[] = [];
  if (!flags.hasMetaAppId) missing.push("META_APP_ID");
  if (!flags.hasMetaAppSecret) missing.push("META_APP_SECRET");
  if (!flags.hasRedirectUri) missing.push("META_OAUTH_REDIRECT_URI");
  return missing;
};

export const getMissingMetaOAuthStateKeys = (
  flags: MetaOAuthConfigFlags
): string[] => {
  if (!flags.hasMetaAppSecret) return ["META_APP_SECRET"];
  return [];
};

export const logMetaOAuthConfigCheck = (
  source: MetaOAuthConfigSource,
  extra?: Record<string, string | number | boolean | null>
): MetaOAuthConfigFlags => {
  const flags = getMetaOAuthConfigFlags();

  logger.info(
    {
      source,
      nodeEnv: process.env.NODE_ENV || null,
      cwd: process.cwd(),
      envFile:
        process.env.NODE_ENV === "test"
          ? ".env.test"
          : ".env",
      ...flags,
      ...extra
    },
    "[InstagramOAuth] config_check"
  );

  return flags;
};

export const logMetaOAuthConfigMissing = (
  source: MetaOAuthConfigSource,
  missingKeys: string[]
): void => {
  if (!missingKeys.length) {
    return;
  }

  logger.warn(
    {
      source,
      missingKeys
    },
    "[InstagramOAuth] config_missing"
  );
};
