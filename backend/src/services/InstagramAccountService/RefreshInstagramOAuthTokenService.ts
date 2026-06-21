import axios, { AxiosError } from "axios";
import AppError from "../../errors/AppError";
import { redactSensitiveText } from "../../helpers/maskSensitive";

/**
 * Refresh de long-lived token Instagram Login (fase futura — cron/job).
 * GET https://graph.instagram.com/refresh_access_token
 *   ?grant_type=ig_refresh_token
 *   &access_token={long_lived_token}
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login#refresh-a-long-lived-token
 */
const INSTAGRAM_REFRESH_TOKEN_URL =
  "https://graph.instagram.com/refresh_access_token";

export interface RefreshInstagramOAuthTokenResult {
  accessToken: string;
  expiresIn: number;
}

const parseRefreshError = (err: unknown): string => {
  const axiosErr = err as AxiosError<{ error?: { message?: string } }>;
  const message = axiosErr.response?.data?.error?.message;
  return message
    ? redactSensitiveText(message)
    : "Falha ao renovar o token Instagram.";
};

export const refreshInstagramOAuthToken = async (
  longLivedToken: string
): Promise<RefreshInstagramOAuthTokenResult> => {
  const token = longLivedToken?.trim();
  if (!token) {
    throw new AppError(
      "ERR_INSTAGRAM_TOKEN_INVALID",
      400,
      "Token inválido para renovação."
    );
  }

  try {
    const { data } = await axios.get(INSTAGRAM_REFRESH_TOKEN_URL, {
      params: {
        grant_type: "ig_refresh_token",
        access_token: token
      },
      timeout: 20000
    });

    const accessToken =
      typeof data?.access_token === "string" ? data.access_token.trim() : "";
    const expiresIn =
      typeof data?.expires_in === "number" ? data.expires_in : 0;

    if (!accessToken) {
      throw new AppError(
        "ERR_INSTAGRAM_OAUTH_REFRESH_FAILED",
        400,
        "Não foi possível renovar o token Instagram."
      );
    }

    return { accessToken, expiresIn };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }

    throw new AppError(
      "ERR_INSTAGRAM_OAUTH_REFRESH_FAILED",
      400,
      "Não foi possível renovar a conexão com o Instagram."
    );
  }
};
