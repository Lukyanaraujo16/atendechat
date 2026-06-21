import { i18n } from "../translate/i18n";

const OAUTH_REASON_CODES = [
  "state_invalid",
  "state_expired",
  "missing_code",
  "missing_scopes",
  "not_business",
  "user_denied",
  "duplicate_account",
];

export const mapInstagramOAuthReason = (reason) => {
  if (!reason) {
    return i18n.t("connections.instagram.oauth.errors.generic");
  }

  if (OAUTH_REASON_CODES.includes(reason)) {
    const key = `connections.instagram.oauth.errors.${reason}`;
    const translated = i18n.t(key);
    if (translated !== key) {
      return translated;
    }
  }

  return reason;
};

export const startInstagramOAuth = async (api, accountId) => {
  const { data } = await api.post(`/instagram-accounts/${accountId}/oauth/start`);
  const authorizationUrl = data?.authorizationUrl;

  if (!authorizationUrl) {
    throw new Error("missing_authorization_url");
  }

  window.location.href = authorizationUrl;
};

export const clearInstagramOAuthQueryParams = (history) => {
  history.replace("/connections");
};

export const getInstagramOAuthCallbackParams = (search) => {
  const params = new URLSearchParams(search);
  const result = params.get("instagramOAuth");

  if (!result) {
    return null;
  }

  return {
    result,
    accountId: params.get("accountId"),
    reason: params.get("reason"),
  };
};

export const hasInstagramOAuthCallback = (search) =>
  Boolean(new URLSearchParams(search).get("instagramOAuth"));

export const formatTokenExpiryDays = (value) => {
  if (!value) {
    return null;
  }

  try {
    const expiresAt = new Date(value);
    const diffMs = expiresAt.getTime() - Date.now();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (days < 0) {
      return i18n.t("connections.instagram.oauth.expired");
    }

    if (days === 0) {
      return i18n.t("connections.instagram.oauth.expiresToday");
    }

    return i18n.t("connections.instagram.oauth.expiresInDays", { days });
  } catch {
    return null;
  }
};

export const refreshInstagramOAuth = async (api, accountId) => {
  const { data } = await api.post(`/instagram-accounts/${accountId}/oauth/refresh`);
  return data;
};
