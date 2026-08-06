/**
 * Helpers de plataforma PWA — cenários obrigatórios de detecção.
 */
import {
  detectPwaPlatform,
  isAndroid,
  isAppleMobile,
  isDesktop,
  isIosWebPushCompatible,
  isIPad,
  isIPadClassic,
  isIPadOsDesktopUa,
  isIPhone,
  isOpenedFromInstalledIcon,
  isPwaStandalone,
  isSafariBrowser,
  parseIosVersion,
  PWA_PLATFORMS,
  supportsBeforeInstallPrompt,
} from "../pwaPlatform";

describe("pwaPlatform", () => {
  it("detecta Android", () => {
    const env = {
      userAgent:
        "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      maxTouchPoints: 5,
      standaloneMedia: false,
      navigatorStandalone: false,
    };
    expect(isAndroid(env)).toBe(true);
    expect(detectPwaPlatform(env)).toBe(PWA_PLATFORMS.ANDROID);
    expect(isDesktop(env)).toBe(false);
  });

  it("detecta iPhone não instalado", () => {
    const env = {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1",
      maxTouchPoints: 5,
      standaloneMedia: false,
      navigatorStandalone: false,
      hasNotification: true,
      hasPushManager: true,
      hasServiceWorker: true,
    };
    expect(isIPhone(env)).toBe(true);
    expect(detectPwaPlatform(env)).toBe(PWA_PLATFORMS.IPHONE);
    expect(isPwaStandalone(env)).toBe(false);
    expect(isIosWebPushCompatible(env)).toBe(true);
  });

  it("detecta iPhone standalone", () => {
    const env = {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1",
      maxTouchPoints: 5,
      standaloneMedia: false,
      navigatorStandalone: true,
      hasNotification: true,
      hasPushManager: true,
      hasServiceWorker: true,
    };
    expect(isPwaStandalone(env)).toBe(true);
    expect(isOpenedFromInstalledIcon(env)).toBe(true);
  });

  it("detecta iPad clássico", () => {
    const env = {
      userAgent:
        "Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 Version/16.5 Mobile/15E148 Safari/604.1",
      maxTouchPoints: 5,
      standaloneMedia: false,
      navigatorStandalone: false,
    };
    expect(isIPadClassic(env)).toBe(true);
    expect(isIPad(env)).toBe(true);
    expect(detectPwaPlatform(env)).toBe(PWA_PLATFORMS.IPAD);
  });

  it("detecta iPadOS em modo desktop (Macintosh + touch)", () => {
    const env = {
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15",
      maxTouchPoints: 5,
      standaloneMedia: false,
      navigatorStandalone: false,
      hasNotification: true,
      hasPushManager: true,
    };
    expect(isIPadOsDesktopUa(env)).toBe(true);
    expect(isIPad(env)).toBe(true);
    expect(isAppleMobile(env)).toBe(true);
    expect(detectPwaPlatform(env)).toBe(PWA_PLATFORMS.IPAD);
    expect(isDesktop(env)).toBe(false);
  });

  it("desktop não é tratado como mobile instalável", () => {
    const env = {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      maxTouchPoints: 0,
      standaloneMedia: false,
      navigatorStandalone: false,
    };
    expect(isDesktop(env)).toBe(true);
    expect(detectPwaPlatform(env)).toBe(PWA_PLATFORMS.DESKTOP);
  });

  it("standalone via display-mode sem depender só de UA", () => {
    const env = {
      userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0 Mobile",
      maxTouchPoints: 5,
      standaloneMedia: true,
      navigatorStandalone: false,
    };
    expect(isPwaStandalone(env)).toBe(true);
  });

  it("suporte a beforeinstallprompt", () => {
    expect(
      supportsBeforeInstallPrompt({ hasBeforeInstallPromptSupport: true })
    ).toBe(true);
    expect(
      supportsBeforeInstallPrompt({ hasBeforeInstallPromptSupport: false })
    ).toBe(false);
  });

  it("iOS incompatível com Web Push (< 16.4)", () => {
    const env = {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 15_7 like Mac OS X) AppleWebKit/605.1.15 Version/15.7 Mobile/15E148 Safari/604.1",
      maxTouchPoints: 5,
      standaloneMedia: false,
      navigatorStandalone: false,
      hasNotification: false,
      hasPushManager: false,
      hasServiceWorker: true,
    };
    expect(parseIosVersion(env.userAgent)).toEqual({ major: 15, minor: 7 });
    expect(isIosWebPushCompatible(env)).toBe(false);
  });

  it("Safari vs navegador alternativo no iOS", () => {
    const safari = {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
    };
    const chromeIos = {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
    };
    expect(isSafariBrowser(safari)).toBe(true);
    expect(isSafariBrowser(chromeIos)).toBe(false);
  });
});
