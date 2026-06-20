import axios, { AxiosError } from "axios";
import AppError from "../../errors/AppError";
import { redactSensitiveText } from "../../helpers/maskSensitive";
import { logger } from "../../utils/logger";

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const FACEBOOK_GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH_VERSIONED = `https://graph.instagram.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH_UNVERSIONED = "https://graph.instagram.com";

export const INSTAGRAM_LOGIN_API_SCOPE = "instagram_login_api";

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
  | "facebook_user_profile"
  | "instagram_sender_profile";

export const META_API_PHASE_LABELS: Record<MetaApiPhase, string> = {
  debug_token: "debug_token",
  instagram_me_versioned: "graph.instagram.com/me",
  instagram_me_unversioned: "graph.instagram.com/me (sem versão)",
  facebook_me_accounts: "graph.facebook.com/me/accounts",
  facebook_user_profile: "graph.facebook.com/{user_id}",
  instagram_sender_profile: "graph.instagram.com/{igsid}"
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

export interface InstagramTokenValidationResult {
  profile: MetaInstagramProfile;
  expiresAt: Date | null;
  scopes: string[];
  validatedVia: MetaApiPhase;
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

const isDebugTokenSkippableError = (err: unknown): boolean => {
  const meta = parseMetaError(err);
  if (!meta) {
    return false;
  }

  if (meta.code === 190 || meta.code === 2) {
    return true;
  }

  return isMetaTemporaryUnavailable(err);
};

const logMetaApiFailure = (
  phase: MetaApiPhase,
  attempt: number,
  maxAttempts: number,
  err: unknown,
  optional = false
): void => {
  const meta = parseMetaError(err);
  logger.warn(
    {
      metaPhase: phase,
      attempt,
      maxAttempts,
      optional,
      temporary: isMetaTemporaryUnavailable(err),
      metaErrorCode: meta?.code,
      metaErrorMessage: meta?.message
        ? redactSensitiveText(meta.message)
        : undefined
    },
    optional
      ? "Meta API optional request failed"
      : "Meta API request failed"
  );
};

const throwMetaTemporaryError = (
  phase: MetaApiPhase,
  context: "validation" | "profile"
): never => {
  const phaseLabel = META_API_PHASE_LABELS[phase];
  const clientMessage =
    context === "validation"
      ? `Falha temporária na Meta ao validar token (${phaseLabel}). Tente novamente.`
      : `Falha temporária na Meta ao buscar perfil (${phaseLabel}). Tente novamente.`;

  throw new AppError("ERR_META_API_TEMPORARY_FAILED", 503, clientMessage, {
    metaPhase: phase
  });
};

const metaGetWithRetry = async <T>(
  phase: MetaApiPhase,
  url: string,
  params: Record<string, string>,
  optional = false
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
      logMetaApiFailure(phase, attempt, maxAttempts, err, optional);

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

const getMetaAppCredentials = (): { appId: string; appSecret: string } | null => {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();

  if (!appId || !appSecret) {
    return null;
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
  const username =
    typeof data?.username === "string" ? data.username : null;

  if (!userId && !username) {
    return null;
  }

  return {
    instagramBusinessAccountId: userId != null ? String(userId) : null,
    name:
      (typeof data?.name === "string" && data.name) ||
      username ||
      null,
    profilePicUrl:
      typeof data?.profile_picture_url === "string"
        ? data.profile_picture_url
        : null,
    facebookPageId: null
  };
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

const runProfileStrategy = async (
  phase: MetaApiPhase,
  fetcher: () => Promise<MetaInstagramProfile | null>
): Promise<ProfileStrategyResult> => {
  try {
    const profile = await fetcher();
    if (profile?.instagramBusinessAccountId || profile?.name) {
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

const requestDebugToken = async (
  inputToken: string,
  optional: boolean
): Promise<MetaDebugTokenData | null> => {
  const phase: MetaApiPhase = "debug_token";
  const credentials = getMetaAppCredentials();

  if (!credentials) {
    if (!optional) {
      throw new AppError(
        "ERR_META_APP_CONFIG_MISSING",
        500,
        "Credenciais Meta não configuradas. Defina META_APP_ID e META_APP_SECRET no servidor."
      );
    }
    return null;
  }

  const appAccessToken = `${credentials.appId}|${credentials.appSecret}`;

  try {
    const data = await metaGetWithRetry<{
      data?: Record<string, unknown>;
    }>(
      phase,
      `${FACEBOOK_GRAPH}/debug_token`,
      {
        input_token: inputToken,
        access_token: appAccessToken
      },
      optional
    );

    const tokenData = data?.data;
    if (!tokenData || typeof tokenData !== "object") {
      return null;
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
    const meta = parseMetaError(err);

    if (optional) {
      logger.warn(
        {
          metaPhase: phase,
          optional: true,
          metaErrorCode: meta?.code,
          metaErrorMessage: meta?.message
            ? redactSensitiveText(meta.message)
            : undefined,
          skipped: isDebugTokenSkippableError(err)
        },
        "debug_token enrichment skipped (non-blocking)"
      );
      return null;
    }

    if (isMetaTemporaryUnavailable(err)) {
      throwMetaTemporaryError(phase, "validation");
    }

    return null;
  }
};

const tryOptionalDebugTokenEnrichment = async (
  inputToken: string
): Promise<MetaDebugTokenData | null> => requestDebugToken(inputToken, true);

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

const defaultScopesForPhase = (phase: MetaApiPhase): string[] => {
  if (
    phase === "instagram_me_unversioned" ||
    phase === "instagram_me_versioned"
  ) {
    return [INSTAGRAM_LOGIN_API_SCOPE];
  }
  return [];
};

/**
 * Valida token da Instagram API priorizando graph.instagram.com/me.
 * debug_token é opcional: enriquece scopes/expiração quando disponível.
 */
export const validateInstagramAccessToken = async (
  accessToken: string
): Promise<InstagramTokenValidationResult> => {
  const strategies: Array<{
    phase: MetaApiPhase;
    run: () => Promise<MetaInstagramProfile | null>;
  }> = [
    {
      phase: "instagram_me_unversioned",
      run: () => fetchInstagramMeUnversioned(accessToken)
    },
    {
      phase: "instagram_me_versioned",
      run: () => fetchInstagramMeVersioned(accessToken)
    },
    {
      phase: "facebook_me_accounts",
      run: () => fetchFacebookPagesProfile(accessToken)
    }
  ];

  let profile: MetaInstagramProfile | null = null;
  let validatedVia: MetaApiPhase | null = null;
  const temporaryPhases: MetaApiPhase[] = [];

  for (const strategy of strategies) {
    const result = await runProfileStrategy(strategy.phase, strategy.run);
    if (result.kind === "profile") {
      profile = result.profile;
      validatedVia = strategy.phase;
      break;
    }
    if (result.kind === "temporary") {
      temporaryPhases.push(result.phase);
    }
  }

  if (!profile) {
    const debugData = await requestDebugToken(accessToken, false);

    if (debugData?.isValid && debugData.userId) {
      const userProfile = await runProfileStrategy(
        "facebook_user_profile",
        () =>
          fetchUserInstagramBusinessAccount(accessToken, debugData.userId as string)
      );

      if (userProfile.kind === "profile") {
        profile = userProfile.profile;
        validatedVia = "debug_token";
      } else if (userProfile.kind === "temporary") {
        temporaryPhases.push(userProfile.phase);
      }
    } else if (debugData?.isValid) {
      validatedVia = "debug_token";
      profile = {
        instagramBusinessAccountId: debugData.userId,
        name: null,
        profilePicUrl: null,
        facebookPageId: null
      };
    }
  }

  if (!profile || !validatedVia) {
    if (temporaryPhases.length) {
      throwMetaTemporaryError(
        temporaryPhases[temporaryPhases.length - 1],
        "validation"
      );
    }

    throw new AppError(
      "ERR_INSTAGRAM_TOKEN_INVALID",
      400,
      "Não foi possível validar o token na Meta. Verifique se o token foi gerado na API do Instagram e tente novamente."
    );
  }

  let scopes = defaultScopesForPhase(validatedVia);
  let expiresAt: Date | null = null;

  const enrichment = await tryOptionalDebugTokenEnrichment(accessToken);
  if (enrichment?.isValid) {
    if (enrichment.scopes.length) {
      scopes = enrichment.scopes;
    }
    expiresAt = enrichment.expiresAt;
  }

  if (
    scopes.length > 0 &&
    scopes[0] !== INSTAGRAM_LOGIN_API_SCOPE &&
    scopes.some(scope =>
      (REQUIRED_INSTAGRAM_SCOPES as readonly string[]).includes(scope)
    )
  ) {
    assertRequiredInstagramScopes(scopes);
  }

  return {
    profile,
    expiresAt,
    scopes,
    validatedVia
  };
};

/** @deprecated Use validateInstagramAccessToken */
export const debugMetaAccessToken = async (
  inputToken: string
): Promise<MetaDebugTokenData> => {
  const data = await requestDebugToken(inputToken, false);
  if (!data) {
    throw new AppError(
      "ERR_INSTAGRAM_TOKEN_INVALID",
      400,
      "Não foi possível validar o token via debug_token."
    );
  }
  return data;
};

/** @deprecated Use validateInstagramAccessToken */
export const fetchInstagramBusinessProfile = async (
  accessToken: string,
  debugData: MetaDebugTokenData
): Promise<MetaInstagramProfile> => {
  const validation = await validateInstagramAccessToken(accessToken);
  if (debugData.userId && !validation.profile.instagramBusinessAccountId) {
    const profile = await fetchUserInstagramBusinessAccount(
      accessToken,
      debugData.userId
    );
    if (profile) {
      return profile;
    }
  }
  return validation.profile;
};

export interface InstagramSenderProfile {
  name: string | null;
  username: string | null;
  profilePicUrl: string | null;
}

export type InstagramSenderProfileLookupResult =
  | {
      ok: true;
      profile: InstagramSenderProfile;
      rawResponse: Record<string, unknown>;
    }
  | {
      ok: false;
      error: string;
      statusCode?: number;
      metaErrorCode?: number;
      rawResponse?: unknown;
    };

const parseInstagramSenderProfile = (
  data: Record<string, unknown>
): InstagramSenderProfile => ({
  name: typeof data.name === "string" ? data.name.trim() || null : null,
  username:
    typeof data.username === "string" ? data.username.trim() || null : null,
  profilePicUrl:
    typeof data.profile_pic === "string"
      ? data.profile_pic.trim() || null
      : null
});

const extractAxiosStatusCode = (err: unknown): number | undefined => {
  const status = (err as AxiosError)?.response?.status;
  return typeof status === "number" ? status : undefined;
};

/**
 * User Profile API — IGSID do webhook + token da conta conectada.
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile/
 */
export const lookupInstagramSenderProfile = async (
  senderId: string,
  accessToken: string
): Promise<InstagramSenderProfileLookupResult> => {
  const phase: MetaApiPhase = "instagram_sender_profile";

  try {
    const data = await metaGetWithRetry<Record<string, unknown>>(
      phase,
      `${INSTAGRAM_GRAPH_VERSIONED}/${senderId}`,
      {
        fields: "name,username,profile_pic",
        access_token: accessToken
      },
      true
    );

    return {
      ok: true,
      profile: parseInstagramSenderProfile(data),
      rawResponse: data
    };
  } catch (err) {
    const meta = parseMetaError(err);
    const axiosErr = err as AxiosError<MetaErrorBody>;

    return {
      ok: false,
      error: meta?.message
        ? redactSensitiveText(meta.message)
        : err instanceof Error
          ? err.message
          : String(err),
      statusCode: extractAxiosStatusCode(err),
      metaErrorCode: meta?.code,
      rawResponse: axiosErr.response?.data
    };
  }
};

/** @deprecated Prefer lookupInstagramSenderProfile para diagnóstico completo. */
export const fetchInstagramSenderProfile = async (
  senderId: string,
  accessToken: string
): Promise<InstagramSenderProfile | null> => {
  const result = await lookupInstagramSenderProfile(senderId, accessToken);
  return result.ok ? result.profile : null;
};

export interface InstagramDirectSendResult {
  messageId: string | null;
  rawResponse: Record<string, unknown>;
}

export const isInstagramMessagingWindowError = (err: unknown): boolean => {
  const meta = parseMetaError(err);
  if (!meta) {
    return false;
  }

  if (meta.error_subcode === 2534022) {
    return true;
  }

  const message = (meta.message || "").toLowerCase();
  return (
    message.includes("24 hour") ||
    message.includes("24-hour") ||
    message.includes("outside of allowed window") ||
    message.includes("outside the allowed window") ||
    message.includes("messaging window")
  );
};

export const isInstagramMediaTooLargeError = (err: unknown): boolean => {
  const meta = parseMetaError(err);
  if (!meta) {
    return false;
  }

  const message = (meta.message || "").toLowerCase();
  return (
    message.includes("file too large") ||
    message.includes("too large") ||
    message.includes("exceeds") ||
    meta.error_subcode === 2018047
  );
};

export const mapInstagramOutboundSendError = (
  err: unknown
): {
  statusCode: number;
  metaCode?: number;
  metaMessage?: string;
  appError: AppError;
} => {
  const axiosErr = err as AxiosError<MetaErrorBody>;
  const meta = parseMetaError(err);
  const statusCode = axiosErr.response?.status ?? 502;
  const metaCode = meta?.code;
  const metaMessage = meta?.message
    ? redactSensitiveText(meta.message)
    : undefined;

  if (isInstagramMessagingWindowError(err)) {
    return {
      statusCode,
      metaCode,
      metaMessage,
      appError: new AppError(
        "ERR_INSTAGRAM_MESSAGING_WINDOW_EXPIRED",
        400,
        "Não foi possível enviar: a janela de resposta do Instagram pode ter expirado."
      )
    };
  }

  if (isInstagramMediaTooLargeError(err)) {
    return {
      statusCode,
      metaCode,
      metaMessage,
      appError: new AppError(
        "ERR_INSTAGRAM_IMAGE_TOO_LARGE",
        400,
        "Imagem muito grande para envio pelo Instagram."
      )
    };
  }

  if (isMetaTemporaryUnavailable(err)) {
    return {
      statusCode,
      metaCode,
      metaMessage,
      appError: new AppError(
        "ERR_META_API_TEMPORARY_FAILED",
        503,
        "Falha temporária na Meta ao enviar mensagem. Tente novamente."
      )
    };
  }

  const clientMessage =
    metaMessage ||
    "Não foi possível enviar a mensagem pelo Instagram. Tente novamente.";

  return {
    statusCode,
    metaCode,
    metaMessage,
    appError: new AppError(
      "ERR_INSTAGRAM_SEND_FAILED",
      statusCode >= 400 && statusCode < 500 ? 400 : 502,
      clientMessage
    )
  };
};

/**
 * Envia texto via Instagram Messaging API (Direct).
 * POST graph.instagram.com/{instagramBusinessAccountId}/messages
 */
export const sendInstagramDirectTextMessage = async (
  instagramBusinessAccountId: string,
  recipientId: string,
  text: string,
  accessToken: string
): Promise<InstagramDirectSendResult> => {
  const { data } = await axios.post<Record<string, unknown>>(
    `${INSTAGRAM_GRAPH_VERSIONED}/${instagramBusinessAccountId}/messages`,
    {
      recipient: { id: recipientId },
      message: { text }
    },
    {
      params: { access_token: accessToken },
      timeout: 15000,
      headers: { "Content-Type": "application/json" }
    }
  );

  const messageIdRaw = data?.message_id ?? data?.id;
  return {
    messageId: messageIdRaw != null ? String(messageIdRaw) : null,
    rawResponse: data ?? {}
  };
};

/**
 * Envia imagem via Instagram Messaging API (URL pública HTTPS).
 * POST graph.instagram.com/{instagramBusinessAccountId}/messages
 */
export const sendInstagramDirectImageMessage = async (
  instagramBusinessAccountId: string,
  recipientId: string,
  imageUrl: string,
  accessToken: string
): Promise<InstagramDirectSendResult> => {
  const { data } = await axios.post<Record<string, unknown>>(
    `${INSTAGRAM_GRAPH_VERSIONED}/${instagramBusinessAccountId}/messages`,
    {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "image",
          payload: {
            url: imageUrl,
            is_reusable: true
          }
        }
      }
    },
    {
      params: { access_token: accessToken },
      timeout: 30000,
      headers: { "Content-Type": "application/json" }
    }
  );

  const messageIdRaw = data?.message_id ?? data?.id;
  return {
    messageId: messageIdRaw != null ? String(messageIdRaw) : null,
    rawResponse: data ?? {}
  };
};

export function buildInstagramContactDisplayName(
  profile: InstagramSenderProfile | null,
  senderId: string
): string {
  const name = profile?.name?.trim();
  const username = profile?.username?.trim();

  if (name && username) {
    return `${name} (@${username})`;
  }
  if (name) {
    return name;
  }
  if (username) {
    return `@${username}`;
  }
  return `Instagram ${senderId}`;
}
