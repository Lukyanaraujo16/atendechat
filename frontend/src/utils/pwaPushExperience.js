/**
 * Estados de experiência de push no PWA (especialmente iOS/iPadOS).
 * Instalação e push permanecem passos separados.
 */

import { PUSH_DOMAIN_STATES } from "./oneSignalPushDomain";
import {
  getDefaultPlatformEnv,
  isAppleMobile,
  isIosWebPushCompatible,
  isPwaStandalone,
} from "./pwaPlatform";

export const PWA_PUSH_UI_STATES = Object.freeze({
  HIDDEN: "hidden",
  IOS_INCOMPATIBLE: "ios_incompatible",
  IOS_NEEDS_INSTALL: "ios_needs_install",
  ACTIVATE: "activate",
  ACTIVE: "active",
  DENIED: "denied",
  INIT_ERROR: "init_error",
  UNSUPPORTED: "unsupported",
});

/**
 * @param {object} input
 * @param {object} [input.env]
 * @param {string} [input.domainState] - PUSH_DOMAIN_STATES
 * @param {string|null} [input.errorCode]
 * @param {boolean} [input.dismissed]
 */
export function derivePwaPushUiState({
  env = getDefaultPlatformEnv(),
  domainState,
  errorCode = null,
  dismissed = false,
} = {}) {
  if (dismissed) return PWA_PUSH_UI_STATES.HIDDEN;

  const standalone = isPwaStandalone(env);
  const apple = isAppleMobile(env);

  if (apple && !isIosWebPushCompatible(env)) {
    return PWA_PUSH_UI_STATES.IOS_INCOMPATIBLE;
  }

  if (apple && !standalone && isIosWebPushCompatible(env)) {
    return PWA_PUSH_UI_STATES.IOS_NEEDS_INSTALL;
  }

  if (domainState === PUSH_DOMAIN_STATES.UNSUPPORTED) {
    return PWA_PUSH_UI_STATES.UNSUPPORTED;
  }

  if (domainState === PUSH_DOMAIN_STATES.NOT_CONFIGURED) {
    return PWA_PUSH_UI_STATES.HIDDEN;
  }

  if (domainState === PUSH_DOMAIN_STATES.SUBSCRIBED) {
    return PWA_PUSH_UI_STATES.ACTIVE;
  }

  if (domainState === PUSH_DOMAIN_STATES.PERMISSION_DENIED) {
    return PWA_PUSH_UI_STATES.DENIED;
  }

  if (
    domainState === PUSH_DOMAIN_STATES.ERROR ||
    errorCode === "init_failed" ||
    errorCode === "sdk_load_failed"
  ) {
    return PWA_PUSH_UI_STATES.INIT_ERROR;
  }

  // Em iOS, só pedir permissão em standalone
  if (apple && !standalone) {
    return PWA_PUSH_UI_STATES.IOS_NEEDS_INSTALL;
  }

  if (
    domainState === PUSH_DOMAIN_STATES.PERMISSION_DEFAULT ||
    domainState === PUSH_DOMAIN_STATES.PERMISSION_GRANTED_UNSUBSCRIBED ||
    domainState === PUSH_DOMAIN_STATES.SUBSCRIBING ||
    domainState === PUSH_DOMAIN_STATES.SDK_LOADING
  ) {
    return PWA_PUSH_UI_STATES.ACTIVATE;
  }

  return PWA_PUSH_UI_STATES.HIDDEN;
}

export function shouldShowPushActivateAction(uiState) {
  return (
    uiState === PWA_PUSH_UI_STATES.ACTIVATE ||
    uiState === PWA_PUSH_UI_STATES.INIT_ERROR
  );
}

export function shouldShowPushBannerForUiState(uiState) {
  return (
    uiState === PWA_PUSH_UI_STATES.ACTIVATE ||
    uiState === PWA_PUSH_UI_STATES.DENIED ||
    uiState === PWA_PUSH_UI_STATES.INIT_ERROR ||
    uiState === PWA_PUSH_UI_STATES.IOS_INCOMPATIBLE ||
    uiState === PWA_PUSH_UI_STATES.IOS_NEEDS_INSTALL
  );
}
