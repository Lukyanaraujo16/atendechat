import { PUSH_DOMAIN_STATES } from "../oneSignalPushDomain";
import {
  derivePwaPushUiState,
  PWA_PUSH_UI_STATES,
  shouldShowPushActivateAction,
  shouldShowPushBannerForUiState,
} from "../pwaPushExperience";

const iphoneEnv = (overrides = {}) => ({
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Version/17.2 Mobile/15E148 Safari/604.1",
  maxTouchPoints: 5,
  standaloneMedia: false,
  navigatorStandalone: false,
  hasNotification: true,
  hasPushManager: true,
  hasServiceWorker: true,
  ...overrides,
});

describe("pwaPushExperience", () => {
  it("iOS incompatível", () => {
    const ui = derivePwaPushUiState({
      env: iphoneEnv({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 Version/15.0 Mobile/15E148 Safari/604.1",
        hasPushManager: false,
        hasNotification: false,
      }),
      domainState: PUSH_DOMAIN_STATES.PERMISSION_DEFAULT,
    });
    expect(ui).toBe(PWA_PUSH_UI_STATES.IOS_INCOMPATIBLE);
    expect(shouldShowPushActivateAction(ui)).toBe(false);
  });

  it("iOS compatível não instalado — não pedir permissão", () => {
    const ui = derivePwaPushUiState({
      env: iphoneEnv(),
      domainState: PUSH_DOMAIN_STATES.PERMISSION_DEFAULT,
    });
    expect(ui).toBe(PWA_PUSH_UI_STATES.IOS_NEEDS_INSTALL);
    expect(shouldShowPushActivateAction(ui)).toBe(false);
  });

  it("iOS standalone permission default — Ativar notificações", () => {
    const ui = derivePwaPushUiState({
      env: iphoneEnv({ navigatorStandalone: true }),
      domainState: PUSH_DOMAIN_STATES.PERMISSION_DEFAULT,
    });
    expect(ui).toBe(PWA_PUSH_UI_STATES.ACTIVATE);
    expect(shouldShowPushActivateAction(ui)).toBe(true);
  });

  it("permission granted / subscription ativa", () => {
    const ui = derivePwaPushUiState({
      env: iphoneEnv({ navigatorStandalone: true }),
      domainState: PUSH_DOMAIN_STATES.SUBSCRIBED,
    });
    expect(ui).toBe(PWA_PUSH_UI_STATES.ACTIVE);
  });

  it("permission denied", () => {
    const ui = derivePwaPushUiState({
      env: iphoneEnv({ navigatorStandalone: true }),
      domainState: PUSH_DOMAIN_STATES.PERMISSION_DENIED,
    });
    expect(ui).toBe(PWA_PUSH_UI_STATES.DENIED);
    expect(shouldShowPushBannerForUiState(ui)).toBe(true);
  });

  it("falha de inicialização", () => {
    const ui = derivePwaPushUiState({
      env: iphoneEnv({ navigatorStandalone: true }),
      domainState: PUSH_DOMAIN_STATES.ERROR,
      errorCode: "init_failed",
    });
    expect(ui).toBe(PWA_PUSH_UI_STATES.INIT_ERROR);
    expect(shouldShowPushActivateAction(ui)).toBe(true);
  });

  it("Android browser continua com opt-in", () => {
    const ui = derivePwaPushUiState({
      env: {
        userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0 Mobile",
        maxTouchPoints: 5,
        standaloneMedia: false,
        navigatorStandalone: false,
      },
      domainState: PUSH_DOMAIN_STATES.PERMISSION_DEFAULT,
    });
    expect(ui).toBe(PWA_PUSH_UI_STATES.ACTIVATE);
  });
});
