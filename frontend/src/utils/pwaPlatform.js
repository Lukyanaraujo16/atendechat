/**
 * Detecção de plataforma / PWA (funções puras, testáveis).
 * Não usar apenas user agent para confirmar instalação.
 */

export const PWA_PLATFORMS = Object.freeze({
  ANDROID: "android",
  IPHONE: "iphone",
  IPAD: "ipad",
  DESKTOP: "desktop",
  OTHER_MOBILE: "other_mobile",
});

/**
 * @param {object} [env]
 * @param {string} [env.userAgent]
 * @param {number} [env.maxTouchPoints]
 * @param {boolean} [env.standaloneMedia]
 * @param {boolean} [env.navigatorStandalone]
 * @param {boolean} [env.hasBeforeInstallPromptSupport]
 * @param {boolean} [env.hasNotification]
 * @param {boolean} [env.hasPushManager]
 * @param {boolean} [env.hasServiceWorker]
 */
export function getDefaultPlatformEnv(overrides = {}) {
  if (typeof window === "undefined") {
    return {
      userAgent: "",
      maxTouchPoints: 0,
      standaloneMedia: false,
      navigatorStandalone: false,
      hasBeforeInstallPromptSupport: false,
      hasNotification: false,
      hasPushManager: false,
      hasServiceWorker: false,
      ...overrides,
    };
  }

  let standaloneMedia = false;
  try {
    standaloneMedia = Boolean(
      window.matchMedia && window.matchMedia("(display-mode: standalone)").matches
    );
  } catch {
    standaloneMedia = false;
  }

  return {
    userAgent: String(window.navigator?.userAgent || ""),
    maxTouchPoints: Number(window.navigator?.maxTouchPoints || 0),
    standaloneMedia,
    navigatorStandalone: Boolean(window.navigator?.standalone),
    hasBeforeInstallPromptSupport: "onbeforeinstallprompt" in window,
    hasNotification: typeof window.Notification !== "undefined",
    hasPushManager: typeof window.PushManager !== "undefined",
    hasServiceWorker: "serviceWorker" in (window.navigator || {}),
    ...overrides,
  };
}

export function isAndroid(env = getDefaultPlatformEnv()) {
  return /Android/i.test(env.userAgent || "");
}

export function isIPhone(env = getDefaultPlatformEnv()) {
  return /iPhone/i.test(env.userAgent || "");
}

/** iPad clássico (UA contém iPad). */
export function isIPadClassic(env = getDefaultPlatformEnv()) {
  return /iPad/i.test(env.userAgent || "");
}

/**
 * iPadOS 13+ em modo desktop: UA de Macintosh + touch.
 */
export function isIPadOsDesktopUa(env = getDefaultPlatformEnv()) {
  const ua = env.userAgent || "";
  const isMac = /Macintosh/i.test(ua);
  const touch = Number(env.maxTouchPoints || 0) > 1;
  return isMac && touch && !isIPhone(env) && !isIPadClassic(env);
}

export function isIPad(env = getDefaultPlatformEnv()) {
  return isIPadClassic(env) || isIPadOsDesktopUa(env);
}

export function isAppleMobile(env = getDefaultPlatformEnv()) {
  return isIPhone(env) || isIPad(env);
}

export function isDesktop(env = getDefaultPlatformEnv()) {
  if (isAndroid(env) || isAppleMobile(env)) return false;
  if (/Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(env.userAgent || "")) {
    return false;
  }
  return true;
}

export function detectPwaPlatform(env = getDefaultPlatformEnv()) {
  if (isAndroid(env)) return PWA_PLATFORMS.ANDROID;
  if (isIPhone(env)) return PWA_PLATFORMS.IPHONE;
  if (isIPad(env)) return PWA_PLATFORMS.IPAD;
  if (isDesktop(env)) return PWA_PLATFORMS.DESKTOP;
  return PWA_PLATFORMS.OTHER_MOBILE;
}

/**
 * Aberto pelo ícone instalado (standalone / display-mode).
 * Não depende só de user agent.
 */
export function isPwaStandalone(env = getDefaultPlatformEnv()) {
  return Boolean(env.standaloneMedia || env.navigatorStandalone);
}

export function supportsBeforeInstallPrompt(env = getDefaultPlatformEnv()) {
  return Boolean(env.hasBeforeInstallPromptSupport);
}

/**
 * Safari (não Chrome/Firefox/CriOS) — fluxo “Adicionar à Tela de Início” mais fiável.
 */
export function isSafariBrowser(env = getDefaultPlatformEnv()) {
  const ua = env.userAgent || "";
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|Android/i.test(ua);
  return isSafari || (/AppleWebKit/i.test(ua) && isAppleMobile(env) && !/CriOS|FxiOS|EdgiOS/i.test(ua));
}

/**
 * Parse versão iOS/iPadOS a partir do UA (quando disponível).
 * @returns {{ major: number, minor: number } | null}
 */
export function parseIosVersion(userAgent = "") {
  const ua = String(userAgent || "");
  const osMatch = ua.match(/OS (\d+)[_.](\d+)(?:[_.](\d+))?/i);
  if (osMatch) {
    return {
      major: Number(osMatch[1]),
      minor: Number(osMatch[2]),
    };
  }
  // iPadOS desktop UA às vezes expõe Version/X.Y
  if (/Macintosh/i.test(ua)) {
    const ver = ua.match(/Version\/(\d+)\.(\d+)/i);
    if (ver) {
      return {
        major: Number(ver[1]),
        minor: Number(ver[2]),
      };
    }
  }
  return null;
}

/**
 * Web Push em PWA na Home Screen: iOS/iPadOS 16.4+.
 * Em standalone, prioriza feature detection.
 */
export function isIosWebPushCompatible(env = getDefaultPlatformEnv()) {
  if (!isAppleMobile(env)) return false;

  if (isPwaStandalone(env)) {
    return Boolean(env.hasNotification && env.hasPushManager && env.hasServiceWorker);
  }

  const version = parseIosVersion(env.userAgent);
  if (version) {
    return version.major > 16 || (version.major === 16 && version.minor >= 4);
  }

  // Sem versão no UA (ex.: iPadOS desktop): feature detect otimista
  return Boolean(env.hasNotification && env.hasPushManager);
}

export function isOpenedFromInstalledIcon(env = getDefaultPlatformEnv()) {
  return isPwaStandalone(env);
}
