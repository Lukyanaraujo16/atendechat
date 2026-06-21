import { hasEncryptedMetaToken } from "../../helpers/metaTokenCrypto";

export const INSTAGRAM_OAUTH_REFRESH_THRESHOLD_DAYS = 7;

export const REFRESHABLE_INSTAGRAM_STATUSES = ["CONNECTED", "EXPIRED"] as const;

export const REFRESH_FAILURE_MESSAGE =
  "Não foi possível renovar a conexão com o Instagram.";

export const REFRESH_RECONNECT_HINT =
  "Reconecte a conta para continuar usando o Instagram.";

export interface InstagramOAuthRefreshMeta {
  daysUntilExpiration: number | null;
  refreshDue: boolean;
  canRefresh: boolean;
}

export const computeInstagramOAuthRefreshMeta = (account: {
  status: string;
  connectedVia: string | null;
  pageAccessToken: string | null;
  tokenExpiresAt: Date | null;
}): InstagramOAuthRefreshMeta => {
  const hasToken = hasEncryptedMetaToken(account.pageAccessToken);
  const canRefresh =
    hasToken &&
    account.connectedVia === "instagram_login" &&
    (REFRESHABLE_INSTAGRAM_STATUSES as readonly string[]).includes(
      account.status
    );

  if (!account.tokenExpiresAt) {
    return {
      daysUntilExpiration: null,
      refreshDue: false,
      canRefresh
    };
  }

  const diffMs = account.tokenExpiresAt.getTime() - Date.now();
  const daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const refreshDue = daysUntilExpiration <= INSTAGRAM_OAUTH_REFRESH_THRESHOLD_DAYS;

  return {
    daysUntilExpiration,
    refreshDue,
    canRefresh
  };
};
