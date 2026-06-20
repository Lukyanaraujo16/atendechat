import axios, { AxiosError } from "axios";
import AppError from "../../errors/AppError";
import { redactSensitiveText } from "../../helpers/maskSensitive";
import { logger } from "../../utils/logger";

/**
 * Instagram Login API — troca authorization code por short-lived token.
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 * POST https://api.instagram.com/oauth/access_token
 */
const INSTAGRAM_OAUTH_ACCESS_TOKEN_URL =
  "https://api.instagram.com/oauth/access_token";

/**
 * Long-lived token exchange (≈60 dias).
 * GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&...
 */
const INSTAGRAM_LONG_LIVED_TOKEN_URL =
  "https://graph.instagram.com/access_token";

export interface InstagramShortLivedTokenResult {
  accessToken: string;
  userId: string;
}

export interface InstagramLongLivedTokenResult {
  accessToken: string;
  expiresIn: number;
}

const parseOAuthError = (err: unknown): string => {
  const axiosErr = err as AxiosError<{
    error_message?: string;
    error?: { message?: string };
  }>;
  const message =
    axiosErr.response?.data?.error_message ||
    axiosErr.response?.data?.error?.message;
  return message
    ? redactSensitiveText(message)
    : "Falha ao trocar o código OAuth na Meta.";
};

const assertMetaOAuthConfig = (): { appId: string; appSecret: string; redirectUri: string } => {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = process.env.META_OAUTH_REDIRECT_URI?.trim();

  if (!appId || !appSecret || !redirectUri) {
    throw new AppError(
      "ERR_META_APP_CONFIG_MISSING",
      500,
      "Configuração Meta incompleta no servidor."
    );
  }

  return { appId, appSecret, redirectUri };
};

export const exchangeInstagramOAuthCode = async (
  code: string
): Promise<InstagramShortLivedTokenResult> => {
  const { appId, appSecret, redirectUri } = assertMetaOAuthConfig();

  logger.info("[InstagramOAuth] code_exchange_started");

  try {
    const body = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: code.trim()
    });

    const { data } = await axios.post(INSTAGRAM_OAUTH_ACCESS_TOKEN_URL, body, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      timeout: 20000
    });

    const accessToken =
      typeof data?.access_token === "string" ? data.access_token.trim() : "";
    const userId =
      data?.user_id != null ? String(data.user_id) : "";

    if (!accessToken) {
      throw new AppError(
        "ERR_INSTAGRAM_OAUTH_EXCHANGE_FAILED",
        400,
        "Não foi possível concluir a conexão com o Instagram."
      );
    }

    logger.info(
      { hasUserId: Boolean(userId) },
      "[InstagramOAuth] short_lived_token_received"
    );

    return { accessToken, userId };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    logger.warn(
      { errorMessage: parseOAuthError(err) },
      "[InstagramOAuth] failed"
    );

    throw new AppError(
      "ERR_INSTAGRAM_OAUTH_EXCHANGE_FAILED",
      400,
      "Não foi possível concluir a conexão com o Instagram."
    );
  }
};

export const exchangeInstagramLongLivedToken = async (
  shortLivedToken: string
): Promise<InstagramLongLivedTokenResult> => {
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appSecret) {
    throw new AppError(
      "ERR_META_APP_CONFIG_MISSING",
      500,
      "Configuração Meta incompleta no servidor."
    );
  }

  try {
    const { data } = await axios.get(INSTAGRAM_LONG_LIVED_TOKEN_URL, {
      params: {
        grant_type: "ig_exchange_token",
        client_secret: appSecret,
        access_token: shortLivedToken
      },
      timeout: 20000
    });

    const accessToken =
      typeof data?.access_token === "string" ? data.access_token.trim() : "";
    const expiresIn =
      typeof data?.expires_in === "number" ? data.expires_in : 0;

    if (!accessToken) {
      throw new AppError(
        "ERR_INSTAGRAM_OAUTH_EXCHANGE_FAILED",
        400,
        "Não foi possível concluir a conexão com o Instagram."
      );
    }

    logger.info(
      { expiresIn },
      "[InstagramOAuth] long_lived_token_received"
    );

    return { accessToken, expiresIn };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    logger.warn(
      { errorMessage: parseOAuthError(err) },
      "[InstagramOAuth] failed"
    );

    throw new AppError(
      "ERR_INSTAGRAM_OAUTH_EXCHANGE_FAILED",
      400,
      "Não foi possível concluir a conexão com o Instagram."
    );
  }
};
