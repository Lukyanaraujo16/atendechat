export const INSTAGRAM_OAUTH_REASON_CODES = {
  EXPIRED: "state_expired",
  INVALID_STATE: "state_invalid",
  MISSING_SCOPES: "missing_scopes",
  NOT_BUSINESS: "not_business",
  CONNECTION_FAILED: "generic",
  NO_CODE: "missing_code",
  USER_DENIED: "user_denied",
  DUPLICATE_ACCOUNT: "duplicate_account",
  PLAN_NOT_AVAILABLE: "plan_not_available"
} as const;

export const INSTAGRAM_OAUTH_ERROR_MESSAGES = {
  EXPIRED: "OAuth expirado. Tente conectar novamente.",
  INVALID_STATE: "Não foi possível validar o retorno da Meta.",
  MISSING_SCOPES: "A conta Instagram não possui permissões necessárias.",
  NOT_BUSINESS:
    "Esta conta Instagram não é Business/Creator ou não está elegível.",
  CONNECTION_FAILED: "Não foi possível concluir a conexão com o Instagram.",
  NO_CODE: "Não foi possível validar o retorno da Meta.",
  USER_DENIED: "Conexão cancelada no Instagram.",
  DUPLICATE_ACCOUNT: "Esta conta Instagram já está conectada nesta empresa.",
  PLAN_NOT_AVAILABLE:
    "Seu plano não possui acesso à integração com Instagram."
} as const;

export const oauthReasonCodeToMessage = (
  code: string
): string => {
  switch (code) {
    case INSTAGRAM_OAUTH_REASON_CODES.EXPIRED:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.EXPIRED;
    case INSTAGRAM_OAUTH_REASON_CODES.INVALID_STATE:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.INVALID_STATE;
    case INSTAGRAM_OAUTH_REASON_CODES.MISSING_SCOPES:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.MISSING_SCOPES;
    case INSTAGRAM_OAUTH_REASON_CODES.NOT_BUSINESS:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.NOT_BUSINESS;
    case INSTAGRAM_OAUTH_REASON_CODES.NO_CODE:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.NO_CODE;
    case INSTAGRAM_OAUTH_REASON_CODES.USER_DENIED:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.USER_DENIED;
    case INSTAGRAM_OAUTH_REASON_CODES.DUPLICATE_ACCOUNT:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.DUPLICATE_ACCOUNT;
    case INSTAGRAM_OAUTH_REASON_CODES.PLAN_NOT_AVAILABLE:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.PLAN_NOT_AVAILABLE;
    default:
      return INSTAGRAM_OAUTH_ERROR_MESSAGES.CONNECTION_FAILED;
  }
};

const getFrontendBaseUrl = (): string =>
  (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");

export const buildInstagramOAuthRedirectUrl = (params: {
  success: boolean;
  accountId?: number;
  reason?: string;
}): string => {
  const url = new URL(`${getFrontendBaseUrl()}/connections`);

  if (params.success) {
    url.searchParams.set("instagramOAuth", "success");
    if (params.accountId != null) {
      url.searchParams.set("accountId", String(params.accountId));
    }
  } else {
    url.searchParams.set("instagramOAuth", "error");
    url.searchParams.set(
      "reason",
      params.reason || INSTAGRAM_OAUTH_REASON_CODES.CONNECTION_FAILED
    );
  }

  return url.toString();
};
