/**
 * Domínio de estado push OneSignal Web SDK v16.
 * Separação explícita: permissão do navegador ≠ inscrição efetiva.
 */

export const PUSH_DOMAIN_STATES = Object.freeze({
  UNSUPPORTED: "unsupported",
  NOT_CONFIGURED: "not_configured",
  SDK_LOADING: "sdk_loading",
  PERMISSION_DEFAULT: "permission_default",
  PERMISSION_DENIED: "permission_denied",
  PERMISSION_GRANTED_UNSUBSCRIBED: "permission_granted_unsubscribed",
  SUBSCRIBING: "subscribing",
  SUBSCRIBED: "subscribed",
  ERROR: "error",
});

/**
 * Inscrição efetiva: optedIn + (subscription id ou token).
 * Não usar apenas Notifications.permission === "granted".
 */
export function isEffectivelySubscribed(snapshot = {}) {
  const optedIn = Boolean(snapshot.optedIn);
  const hasChannel = Boolean(snapshot.subscriptionId || snapshot.token);
  return optedIn && hasChannel;
}

export function readNativePermission() {
  if (typeof Notification === "undefined") {
    return "unsupported";
  }
  try {
    return Notification.permission || "default";
  } catch {
    return "unsupported";
  }
}

/**
 * @param {object} input
 * @param {boolean} input.onesignalEnabled
 * @param {string} input.onesignalAppId
 * @param {boolean} input.pushSupported
 * @param {boolean} input.sdkReady
 * @param {boolean} input.sdkLoading
 * @param {string} input.permissionNative - default|granted|denied|unsupported
 * @param {boolean} input.optedIn
 * @param {string|null} input.subscriptionId
 * @param {string|null} input.token
 * @param {boolean} input.subscribing
 * @param {string|null} input.errorCode
 */
export function derivePushDomainState(input = {}) {
  const {
    onesignalEnabled = false,
    onesignalAppId = "",
    pushSupported = true,
    sdkReady = false,
    sdkLoading = false,
    permissionNative = "default",
    optedIn = false,
    subscriptionId = null,
    token = null,
    subscribing = false,
    errorCode = null,
  } = input;

  if (!pushSupported || permissionNative === "unsupported") {
    return PUSH_DOMAIN_STATES.UNSUPPORTED;
  }
  if (!onesignalEnabled || !onesignalAppId) {
    return PUSH_DOMAIN_STATES.NOT_CONFIGURED;
  }
  if (subscribing) {
    return PUSH_DOMAIN_STATES.SUBSCRIBING;
  }
  if (isEffectivelySubscribed({ optedIn, subscriptionId, token })) {
    return PUSH_DOMAIN_STATES.SUBSCRIBED;
  }
  if (sdkLoading && !sdkReady) {
    return PUSH_DOMAIN_STATES.SDK_LOADING;
  }
  if (errorCode) {
    return PUSH_DOMAIN_STATES.ERROR;
  }
  if (permissionNative === "denied") {
    return PUSH_DOMAIN_STATES.PERMISSION_DENIED;
  }
  if (permissionNative === "granted") {
    return PUSH_DOMAIN_STATES.PERMISSION_GRANTED_UNSUBSCRIBED;
  }
  return PUSH_DOMAIN_STATES.PERMISSION_DEFAULT;
}

/** Banner de opt-in deve pedir ação do utilizador. */
export function shouldShowPushOptInBanner(domainState, { dismissed = false } = {}) {
  if (dismissed) return false;
  return (
    domainState === PUSH_DOMAIN_STATES.PERMISSION_DEFAULT ||
    domainState === PUSH_DOMAIN_STATES.PERMISSION_GRANTED_UNSUBSCRIBED ||
    domainState === PUSH_DOMAIN_STATES.ERROR
  );
}

/** Banner de ajuda quando o browser bloqueou permanentemente. */
export function shouldShowPushDeniedHelp(domainState, { dismissed = false } = {}) {
  if (dismissed) return false;
  return domainState === PUSH_DOMAIN_STATES.PERMISSION_DENIED;
}

export function normalizeSubscriptionChangeEvent(event, fallbackApi) {
  const current = event?.current || {};
  const fromApi = fallbackApi?.User?.PushSubscription || {};
  return {
    optedIn: Boolean(
      current.optedIn != null ? current.optedIn : fromApi.optedIn
    ),
    subscriptionId:
      (current.id != null && String(current.id)) ||
      (fromApi.id != null && String(fromApi.id)) ||
      null,
    token:
      (current.token != null && String(current.token)) ||
      (fromApi.token != null && String(fromApi.token)) ||
      null,
  };
}
