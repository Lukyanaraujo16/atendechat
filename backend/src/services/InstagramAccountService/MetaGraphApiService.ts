import axios, { AxiosError } from "axios";
import AppError from "../../errors/AppError";
import { redactSensitiveText } from "../../helpers/maskSensitive";
import { logger } from "../../utils/logger";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const FACEBOOK_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH_VERSIONED = `https://graph.instagram.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH_UNVERSIONED = "https://graph.instagram.com";

export const REQUIRED_INSTAGRAM_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments"
] as const;

export type MetaApiPhase =
  | "debug_token"
  | "instagram_me_versioned"
  | "instagram_me_unversioned"
  | "facebook_me_accounts"
  | "facebook_user_profile";

export const META_API_PHASE_LABELS: Record<MetaApiPhase, string> = {
  debug_token: "debug_token",
  instagram_me_versioned: "graph.instagram.com/me",
  instagram_me_unversioned: "graph.instagram.com/me (sem versão)",
  facebook_me_accounts: "graph.facebook.com/me/accounts",
  facebook_user_profile: "graph.facebook.com/{user_id}"
};

const RETRY_DELAYS_MS = [1000, 2000, 4000];

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

type MetaErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

type ProfileStrategyResult =
  | { kind: "profile"; profile: MetaInstagramProfile }
  | { kind: "temporary"; phase: MetaApiPhase }
  | { kind: "miss" };

const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const parseMetaError = (
  err: unknown
): MetaErrorBody["error"] | undefined => {
  const axiosErr = err as AxiosError<MetaErrorBody>;
  return axiosErr.response?.data?.error;
};

export const isMetaTemporaryUnavailable = (err: unknown): boolean => {
  const meta = parseMetaError(err);
  if (!meta) {
    return false;
  }

  if (meta.code === 2) {
    return true;
  }

  const message = (meta.message || "").toLowerCase();
  return (
    message.includes("service temporarily unavailable") ||
    message.includes("temporarily unavailable")
  );
};

const logMetaApiFailure = (
  phase: MetaApiPhase,
  attempt: number,
  maxAttempts: number,
  err: unknown
): void => {
  const meta = parseMetaError(err);
  logger.warn(
    {
      metaPhase: phase,
      attempt,
      maxAttempts,
      temporary: isMetaTemporaryUnavailable(err),
      metaErrorCode: meta?.code,
      metaErrorMessage: meta?.message
        ? redactSensitiveText(meta.message)
        : undefined
    },
    "Meta API request failed"
  );
};

const throwMetaTemporaryError = (
  phase: MetaApiPhase,
  context: "debug" | "profile"
): never => {
  const phaseLabel = META_API_PHASE_LABELS[phase];
  const clientMessage =
    context === "debug"
      ? `Falha temporária na Meta ao validar token (${phaseLabel}). Tente novamente.`
      : `Falha temporária na Meta ao buscar perfil (${phaseLabel}). Tente novamente.`;

  throw new AppError("ERR_META_API_TEMPORARY_FAILED", 503, clientMessage, {
    metaPhase: phase
  });
};

const throwMetaDebugError = (phase: MetaApiPhase, err: unknown): never => {
  if (isMetaTemporaryUnavailable(err)) {
    throwMetaTemporaryError(phase, "debug");
  }

  const meta = parseMetaError(err);
  const safeMessage = meta?.message
    ? redactSensitiveText(meta.message)
    : "Falha ao consultar a API da Meta.";

  throw new AppError("ERR_META_API_FAILED", 400, safeMessage, {
    metaPhase: phase
  });
};

const metaGetWithRetry = async <T>(
  phase: MetaApiPhase,
  url: string,
  params: Record<string, string>
): Promise<T> => {
  const maxAttempts = RETRY_DELAYS_MS.length + 1;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { data } = await axios.get<T>(url, {
        params,
        timeout: 15000
      });
      return data;
    } catch (err) {
      lastErr = err;
      logMetaApiFailure(phase, attempt, maxAttempts, err);

      const temporary = isMetaTemporaryUnavailable(err);
      if (temporary && attempt < maxAttempts) {
        await sleep(RETRY_DELAYS_MS[attempt - 1]);
        continue;
      }

      throw err;
    }
  }

  throw lastErr;
};

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

const mapInstagramMeData = (
  data: Record<string, unknown> | null | undefined
): MetaInstagramProfile | null => {
  const userId = data?.user_id ?? data?.id;
  if (!userId) {
    return null;
  }

  return {
    instagramBusinessAccountId: String(userId),
    name:
      (typeof data?.name === "string" && data.name) ||
      (typeof data?.username === "string" && data.username) ||
      null,
    profilePicUrl:
      typeof data?.profile_picture_url === "string"
        ? data.profile_picture_url
        : null,
    facebookPageId: null
  };
};

export const debugMetaAccessToken = async (
  inputToken: string
): Promise<MetaDebugTokenData> => {
  const phase: MetaApiPhase = "debug_token";
  const { appId, appSecret } = getMetaAppCredentials();
  const appAccessToken = `${appId}|${appSecret}`;

  try {
    const data = await metaGetWithRetry<{
      data?: Record<string, unknown>;
    }>(phase, `${FACEBOOK_GRAPH}/debug_token`, {
      input_token: inputToken,
      access_token: appAccessToken
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
    if (err instanceof AppError) {
      throw err;
    }
    throwMetaDebugError(phase, err);
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

const runProfileStrategy = async (
  phase: MetaApiPhase,
  fetcher: () => Promise<MetaInstagramProfile | null>
): Promise<ProfileStrategyResult> => {
  try {
    const profile = await fetcher();
    if (profile?.instagramBusinessAccountId) {
      return { kind: "profile", profile };
    }
    return { kind: "miss" };
  } catch (err) {
    if (isMetaTemporaryUnavailable(err)) {
      return { kind: "temporary", phase };
    }

    const meta = parseMetaError(err);
    logger.warn(
      {
        metaPhase: phase,
        metaErrorCode: meta?.code,
        metaErrorMessage: meta?.message
          ? redactSensitiveText(meta.message)
          : undefined
      },
      "Meta profile strategy failed (non-temporary)"
    );
    return { kind: "miss" };
  }
};

const fetchInstagramMeVersioned = async (
  accessToken: string
): Promise<MetaInstagramProfile | null> => {
  const phase: MetaApiPhase = "instagram_me_versioned";
  const data = await metaGetWithRetry<Record<string, unknown>>(
    phase,
    `${INSTAGRAM_GRAPH_VERSIONED}/me`,
    {
      fields: "user_id,username,name,profile_picture_url",
      access_token: accessToken
    }
  );
  return mapInstagramMeData(data);
};

const fetchInstagramMeUnversioned = async (
  accessToken: string
): Promise<MetaInstagramProfile | null> => {
  const phase: MetaApiPhase = "instagram_me_unversioned";
  const data = await metaGetWithRetry<Record<string, unknown>>(
    phase,
    `${INSTAGRAM_GRAPH_UNVERSIONED}/me`,
    {
      fields: "user_id,username,name,profile_picture_url",
      access_token: accessToken
    }
  );
  return mapInstagramMeData(data);
};

const fetchFacebookPagesProfile = async (
  accessToken: string
): Promise<MetaInstagramProfile | null> => {
  const phase: MetaApiPhase = "facebook_me_accounts";
  const data = await metaGetWithRetry<{ data?: Array<Record<string, unknown>> }>(
    phase,
    `${FACEBOOK_GRAPH}/me/accounts`,
    {
      fields:
        "id,name,instagram_business_account{id,username,name,profile_picture_url}",
      access_token: accessToken
    }
  );

  const pages = Array.isArray(data?.data) ? data.data : [];
  for (const page of pages) {
    const ig = page?.instagram_business_account as
      | Record<string, unknown>
      | undefined;
    if (ig?.id) {
      return {
        instagramBusinessAccountId: String(ig.id),
        name:
          (typeof ig.name === "string" && ig.name) ||
          (typeof ig.username === "string" && ig.username) ||
          (typeof page.name === "string" && page.name) ||
          null,
        profilePicUrl:
          typeof ig.profile_picture_url === "string"
            ? ig.profile_picture_url
            : null,
        facebookPageId: page.id ? String(page.id) : null
      };
    }
  }

  return null;
};

const fetchUserInstagramBusinessAccount = async (
  accessToken: string,
  userId: string
): Promise<MetaInstagramProfile | null> => {
  const phase: MetaApiPhase = "facebook_user_profile";
  const data = await metaGetWithRetry<Record<string, unknown>>(
    phase,
    `${FACEBOOK_GRAPH}/${userId}`,
    {
      fields: "id,username,name,profile_picture_url",
      access_token: accessToken
    }
  );

  if (!data?.id) {
    return null;
  }

  return {
    instagramBusinessAccountId: String(data.id),
    name:
      (typeof data.name === "string" && data.name) ||
      (typeof data.username === "string" && data.username) ||
      null,
    profilePicUrl:
      typeof data.profile_picture_url === "string"
        ? data.profile_picture_url
        : null,
    facebookPageId: null
  };
};

/**
 * Obtém perfil Instagram Business.
 * Ordem: graph.instagram.com/{version}/me → graph.instagram.com/me →
 * graph.facebook.com/me/accounts → graph.facebook.com/{user_id}.
 */
export const fetchInstagramBusinessProfile = async (
  accessToken: string,
  debugData: MetaDebugTokenData
): Promise<MetaInstagramProfile> => {
  const strategies: Array<{
    phase: MetaApiPhase;
    run: () => Promise<MetaInstagramProfile | null>;
  }> = [
    {
      phase: "instagram_me_versioned",
      run: () => fetchInstagramMeVersioned(accessToken)
    },
    {
      phase: "instagram_me_unversioned",
      run: () => fetchInstagramMeUnversioned(accessToken)
    },
    {
      phase: "facebook_me_accounts",
      run: () => fetchFacebookPagesProfile(accessToken)
    }
  ];

  if (debugData.userId) {
    strategies.push({
      phase: "facebook_user_profile",
      run: () =>
        fetchUserInstagramBusinessAccount(accessToken, debugData.userId as string)
    });
  }

  const temporaryPhases: MetaApiPhase[] = [];

  for (const strategy of strategies) {
    const result = await runProfileStrategy(strategy.phase, strategy.run);
    if (result.kind === "profile") {
      return result.profile;
    }
    if (result.kind === "temporary") {
      temporaryPhases.push(result.phase);
    }
  }

  if (temporaryPhases.length) {
    throwMetaTemporaryError(
      temporaryPhases[temporaryPhases.length - 1],
      "profile"
    );
  }

  throw new AppError(
    "ERR_INSTAGRAM_PROFILE_NOT_FOUND",
    400,
    "Token válido, mas não foi possível obter os dados da conta Instagram na Meta."
  );
};
