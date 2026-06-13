import axios, { AxiosError } from "axios";
import AppError from "../../errors/AppError";
import { redactSensitiveText } from "../../helpers/maskSensitive";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const FACEBOOK_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH = `https://graph.instagram.com/${GRAPH_VERSION}`;

export const REQUIRED_INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments"
] as const;

export interface MetaDebugTokenData {
  isValid: boolean;
  expiresAt: Date | null;
  scopes: string[];
  userId: string | null;
}

export interface MetaInstagramProfile {
  instagramBusinessAccountId: string | null;
  name: string | null;
  profilePicUrl: string | null;
  facebookPageId: string | null;
}

const getMetaAppCredentials = (): { appId: string; appSecret: string } => {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    throw new AppError(
      "ERR_META_APP_CONFIG_MISSING",
      500,
      "Credenciais Meta não configuradas. Defina META_APP_ID e META_APP_SECRET no servidor."
    );
  }

  return { appId, appSecret };
};

const collectScopes = (data: Record<string, unknown>): string[] => {
  const scopes = new Set<string>();

  if (Array.isArray(data.scopes)) {
    data.scopes.forEach(scope => {
      if (typeof scope === "string") scopes.add(scope);
    });
  }

  const granular = data.granular_scopes;
  if (Array.isArray(granular)) {
    granular.forEach(item => {
      if (item && typeof item === "object" && "scope" in item) {
        const scope = (item as { scope?: string }).scope;
        if (scope) scopes.add(scope);
      }
    });
  }

  return Array.from(scopes);
};

const parseExpiresAt = (expiresAt: unknown): Date | null => {
  if (expiresAt === 0 || expiresAt === "0" || expiresAt == null) {
    return null;
  }
  const unix = Number(expiresAt);
  if (!Number.isFinite(unix) || unix <= 0) {
    return null;
  }
  return new Date(unix * 1000);
};

const mapMetaApiError = (err: unknown, fallbackCode: string): AppError => {
  if (err instanceof AppError) {
    return err;
  }

  const axiosErr = err as AxiosError<{ error?: { message?: string; code?: number } }>;
  const metaMessage = axiosErr.response?.data?.error?.message;
  const safeMessage = metaMessage
    ? redactSensitiveText(metaMessage)
    : "Falha ao consultar a API da Meta.";

  return new AppError(fallbackCode, 400, safeMessage);
};

export const debugMetaAccessToken = async (
  inputToken: string
): Promise<MetaDebugTokenData> => {
  const { appId, appSecret } = getMetaAppCredentials();
  const appAccessToken = `${appId}|${appSecret}`;

  try {
    const { data } = await axios.get(`${FACEBOOK_GRAPH}/debug_token`, {
      params: {
        input_token: inputToken,
        access_token: appAccessToken
      },
      timeout: 15000
    });

    const tokenData = data?.data;
    if (!tokenData || typeof tokenData !== "object") {
      throw new AppError(
        "ERR_INSTAGRAM_TOKEN_INVALID",
        400,
        "Resposta inválida ao validar o token na Meta."
      );
    }

    const record = tokenData as Record<string, unknown>;

    return {
      isValid: record.is_valid === true,
      expiresAt: parseExpiresAt(record.expires_at),
      scopes: collectScopes(record),
      userId:
        typeof record.user_id === "string"
          ? record.user_id
          : record.user_id != null
            ? String(record.user_id)
            : null
    };
  } catch (err) {
    throw mapMetaApiError(err, "ERR_META_API_FAILED");
  }
};

export const assertRequiredInstagramScopes = (scopes: string[]): void => {
  const missing = REQUIRED_INSTAGRAM_SCOPES.filter(
    required => !scopes.includes(required)
  );

  if (missing.length) {
    throw new AppError(
      "ERR_INSTAGRAM_TOKEN_MISSING_SCOPES",
      400,
      `O token não possui todas as permissões necessárias. Faltam: ${missing.join(", ")}.`,
      { missingScopes: missing.join(",") }
    );
  }
};

const fetchInstagramMeProfile = async (
  accessToken: string
): Promise<MetaInstagramProfile | null> => {
  try {
    const { data } = await axios.get(`${INSTAGRAM_GRAPH}/me`, {
      params: {
        fields: "user_id,username,name,profile_picture_url",
        access_token: accessToken
      },
      timeout: 15000
    });

    if (!data?.user_id) {
      return null;
    }

    return {
      instagramBusinessAccountId: String(data.user_id),
      name: data.name || data.username || null,
      profilePicUrl: data.profile_picture_url || null,
      facebookPageId: null
    };
  } catch {
    return null;
  }
};

const fetchFacebookPagesProfile = async (
  accessToken: string
): Promise<MetaInstagramProfile | null> => {
  try {
    const { data } = await axios.get(`${FACEBOOK_GRAPH}/me/accounts`, {
      params: {
        fields:
          "id,name,instagram_business_account{id,username,name,profile_picture_url}",
        access_token: accessToken
      },
      timeout: 15000
    });

    const pages = Array.isArray(data?.data) ? data.data : [];
    for (const page of pages) {
      const ig = page?.instagram_business_account;
      if (ig?.id) {
        return {
          instagramBusinessAccountId: String(ig.id),
          name: ig.name || ig.username || page.name || null,
          profilePicUrl: ig.profile_picture_url || null,
          facebookPageId: page.id ? String(page.id) : null
        };
      }
    }

    return null;
  } catch {
    return null;
  }
};

const fetchUserInstagramBusinessAccount = async (
  accessToken: string,
  userId: string
): Promise<MetaInstagramProfile | null> => {
  try {
    const { data } = await axios.get(`${FACEBOOK_GRAPH}/${userId}`, {
      params: {
        fields: "id,username,name,profile_picture_url",
        access_token: accessToken
      },
      timeout: 15000
    });

    if (!data?.id) {
      return null;
    }

    return {
      instagramBusinessAccountId: String(data.id),
      name: data.name || data.username || null,
      profilePicUrl: data.profile_picture_url || null,
      facebookPageId: null
    };
  } catch {
    return null;
  }
};

/**
 * Tenta obter o perfil Instagram Business a partir do token.
 * Ordem: graph.instagram.com/me → graph.facebook.com/me/accounts → /{user_id}.
 * facebookPageId pode permanecer null quando o token é gerado direto na API do Instagram.
 */
export const fetchInstagramBusinessProfile = async (
  accessToken: string,
  debugData: MetaDebugTokenData
): Promise<MetaInstagramProfile> => {
  const strategies = [
    () => fetchInstagramMeProfile(accessToken),
    () => fetchFacebookPagesProfile(accessToken),
    () =>
      debugData.userId
        ? fetchUserInstagramBusinessAccount(accessToken, debugData.userId)
        : Promise.resolve(null)
  ];

  for (const strategy of strategies) {
    const profile = await strategy();
    if (profile?.instagramBusinessAccountId) {
      return profile;
    }
  }

  throw new AppError(
    "ERR_INSTAGRAM_PROFILE_NOT_FOUND",
    400,
    "Token válido, mas não foi possível obter os dados da conta Instagram na Meta."
  );
};
