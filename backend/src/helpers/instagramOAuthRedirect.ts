export const INSTAGRAM_OAUTH_ERROR_MESSAGES = {
  EXPIRED: "OAuth expirado. Tente conectar novamente.",
  INVALID_STATE: "Não foi possível validar o retorno da Meta.",
  MISSING_SCOPES: "A conta Instagram não possui permissões necessárias.",
  NOT_BUSINESS:
    "Esta conta Instagram não é Business/Creator ou não está elegível.",
  CONNECTION_FAILED: "Não foi possível concluir a conexão com o Instagram.",
  NO_CODE: "Não foi possível validar o retorno da Meta.",
  USER_DENIED: "Conexão cancelada no Instagram."
} as const;

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
      params.reason || INSTAGRAM_OAUTH_ERROR_MESSAGES.CONNECTION_FAILED
    );
  }

  return url.toString();
};
