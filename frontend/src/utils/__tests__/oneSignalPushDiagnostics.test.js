/**
 * Diagnóstico instrumentado Firefox (Fase 2.13D).
 */
import {
  PUSH_DIAG_TIMELINE_LIMIT,
  ONESIGNAL_DIAG_FLAG_KEY,
  __resetPushDiagnosticsForTests,
  buildOneSignalPushDiagnostics,
  canExposeOneSignalDiagnostics,
  classifySubscriptionField,
  getPushDiagnosticTimeline,
  maskEndpoint,
  recordPushDiagnosticEvent,
  sanitizeDiagnosticError,
} from "../oneSignalPushDiagnostics";
import { maskSubscriptionId } from "../oneSignalServiceWorkerPaths";
import {
  __forceOneSignalReadyForTests,
  __resetOneSignalServiceForTests,
  __setPushWaitMsForTests,
  enableOneSignalPushSubscription,
  getOneSignalPushDiagnostics,
  getOneSignalPushStatus,
  oneSignalLogout,
  exposeOneSignalPushDiagnosticsGlobal,
} from "../../services/oneSignalService";
import * as openApiModule from "../../services/api";
import {
  getOneSignalServiceWorkerPath,
  getOneSignalServiceWorkerScope,
} from "../oneSignalServiceWorkerPaths";

jest.mock("../../services/api", () => ({
  openApi: { get: jest.fn() },
  default: {},
}));

jest.mock("../../serviceWorkerRegistration", () => ({
  registerMinimalPwaServiceWorker: jest.fn(),
}));

function createMockSdk({
  optedIn = false,
  id = null,
  token = null,
  optInImpl,
} = {}) {
  const listeners = { change: [] };
  const state = { optedIn, id, token };
  const PushSubscription = {
    get optedIn() {
      return state.optedIn;
    },
    get id() {
      return state.id;
    },
    get token() {
      return state.token;
    },
    optIn: jest.fn(async () => {
      if (typeof optInImpl === "function") {
        return optInImpl(state, listeners);
      }
      state.optedIn = true;
      state.id = "sub-confirmed";
      state.token = "tok-confirmed";
      listeners.change.forEach((fn) =>
        fn({
          previous: { optedIn: false, id: null, token: null },
          current: { optedIn: true, id: state.id, token: state.token },
        })
      );
    }),
    addEventListener: jest.fn((event, fn) => {
      if (event === "change") listeners.change.push(fn);
    }),
    removeEventListener: jest.fn((event, fn) => {
      if (event === "change") {
        listeners.change = listeners.change.filter((x) => x !== fn);
      }
    }),
  };
  return {
    state,
    listeners,
    User: { PushSubscription, addTags: jest.fn() },
    Notifications: {
      isPushSupported: jest.fn(() => true),
      requestPermission: jest.fn(async () => true),
      addEventListener: jest.fn(),
    },
    login: jest.fn(async () => {}),
    logout: jest.fn(async () => {}),
    init: jest.fn(async () => {}),
  };
}

describe("oneSignalPushDiagnostics (2.13D)", () => {
  const originalNotification = global.Notification;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    __resetOneSignalServiceForTests();
    __resetPushDiagnosticsForTests();
    __setPushWaitMsForTests(80, 120);
    openApiModule.openApi.get.mockReset();
    openApiModule.openApi.get.mockResolvedValue({
      data: {
        onesignalEnabled: true,
        onesignalAppId: "app-id-test",
        onesignalEnvironment: "development",
      },
    });
    global.Notification = { permission: "default" };
    process.env.NODE_ENV = "test";
    try {
      localStorage.removeItem(ONESIGNAL_DIAG_FLAG_KEY);
    } catch {
      /* ignore */
    }
  });

  afterEach(() => {
    __resetOneSignalServiceForTests();
    global.Notification = originalNotification;
    process.env.NODE_ENV = originalEnv;
    try {
      delete window.__atendechatOneSignalDiagnostics;
    } catch {
      /* ignore */
    }
  });

  it("mascara Subscription ID e não expõe token completo", async () => {
    const fullId = "abcd1234-5678-90ab-cdef-uvwxyz9999";
    const fullToken = "very-secret-push-token-value-xyz";
    const api = createMockSdk({
      optedIn: true,
      id: fullId,
      token: fullToken,
    });
    __forceOneSignalReadyForTests(api);
    const diag = await getOneSignalPushDiagnostics();
    const json = JSON.stringify(diag);
    expect(diag.maskedSubscriptionId).toBe(maskSubscriptionId(fullId));
    expect(diag.maskedSubscriptionId).not.toBe(fullId);
    expect(json).not.toContain(fullToken);
    expect(json).not.toContain(fullId);
    expect(diag.hasToken).toBe(true);
    expect(diag.tokenLength).toBeGreaterThan(0);
    expect(diag).not.toHaveProperty("token");
  });

  it("timeline é limitada ao máximo configurado", () => {
    for (let i = 0; i < PUSH_DIAG_TIMELINE_LIMIT + 20; i += 1) {
      recordPushDiagnosticEvent(`evt_${i}`, { i });
    }
    const tl = getPushDiagnosticTimeline();
    expect(tl.length).toBe(PUSH_DIAG_TIMELINE_LIMIT);
    expect(tl[0].name).toBe(`evt_20`);
    expect(tl[tl.length - 1].name).toBe(`evt_${PUSH_DIAG_TIMELINE_LIMIT + 19}`);
  });

  it("sanitize remove padrões de JWT/Bearer", () => {
    const s = sanitizeDiagnosticError({
      message: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def failed",
    });
    expect(s.message).not.toMatch(/eyJ/);
    expect(s.message).not.toMatch(/Bearer eyJ/i);
  });

  it("maskEndpoint não retorna endpoint completo", () => {
    const m = maskEndpoint(
      "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABlSecretTokenHere"
    );
    expect(m.hasEndpoint).toBe(true);
    expect(m.endpointHost).toContain("mozilla");
    expect(m.endpointMasked).not.toContain("SecretTokenHere");
  });

  it("classifica undefined/null/empty/thenable/string", () => {
    expect(classifySubscriptionField(undefined).kind).toBe("undefined");
    expect(classifySubscriptionField(null).kind).toBe("null");
    expect(classifySubscriptionField("").kind).toBe("empty_string");
    expect(classifySubscriptionField(Promise.resolve("x")).kind).toBe("thenable");
    expect(classifySubscriptionField("abc").present).toBe(true);
  });

  it("Firefox: optIn resolve antes do change tardio com id/token", async () => {
    const api = createMockSdk({
      optInImpl: async (state, listeners) => {
        state.optedIn = true;
        state.id = null;
        state.token = null;
        setTimeout(() => {
          state.id = "ff-late-id";
          state.token = "ff-late-token";
          listeners.change.forEach((fn) =>
            fn({
              previous: { optedIn: true, id: null, token: null },
              current: {
                optedIn: true,
                id: state.id,
                token: state.token,
              },
            })
          );
        }, 25);
      },
    });
    __forceOneSignalReadyForTests(api);
    __setPushWaitMsForTests(200, 500);
    global.Notification.permission = "granted";

    const result = await enableOneSignalPushSubscription({ user: { id: 77 } });
    expect(result.ok).toBe(true);
    expect(api.login).toHaveBeenCalledWith("77");
    const tl = getPushDiagnosticTimeline();
    expect(tl.some((e) => e.name === "optin_resolved")).toBe(true);
    expect(tl.some((e) => e.name === "subscription_change_received")).toBe(true);
    expect(
      tl.some(
        (e) =>
          e.name === "login_started" || e.name === "identity_login_started"
      )
    ).toBe(true);
  });

  it("timeout é diagnosticado quando id/token não chegam", async () => {
    const api = createMockSdk({
      optInImpl: async (state) => {
        state.optedIn = true;
        state.id = null;
        state.token = null;
      },
    });
    __forceOneSignalReadyForTests(api);
    __setPushWaitMsForTests(40, 80);
    global.Notification.permission = "granted";

    const result = await enableOneSignalPushSubscription({ user: { id: 8 } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("subscription_missing_after_permission");
    const diag = await getOneSignalPushDiagnostics();
    expect(
      diag.lastPushError != null ||
        diag.timeline.some((e) => e.name === "timeout")
    ).toBe(true);
    expect(diag.optedIn).toBe(true);
    expect(diag.hasSubscriptionId).toBe(false);
    expect(diag.hasToken).toBe(false);
  });

  it("optedIn true sem ID não confirma sucesso", async () => {
    const api = createMockSdk({
      optInImpl: async (state) => {
        state.optedIn = true;
        state.id = null;
        state.token = null;
      },
    });
    __forceOneSignalReadyForTests(api);
    __setPushWaitMsForTests(40, 80);
    global.Notification.permission = "granted";
    const result = await enableOneSignalPushSubscription({ user: { id: 3 } });
    expect(result.ok).toBe(false);
    expect(getOneSignalPushStatus().domainState).not.toBe("subscribed");
  });

  it("ID presente sem token ainda confirma (canal id)", async () => {
    const api = createMockSdk({
      optInImpl: async (state, listeners) => {
        state.optedIn = true;
        state.id = "id-only";
        state.token = null;
        listeners.change.forEach((fn) =>
          fn({
            previous: {},
            current: { optedIn: true, id: "id-only", token: null },
          })
        );
      },
    });
    __forceOneSignalReadyForTests(api);
    const result = await enableOneSignalPushSubscription({ user: { id: 4 } });
    expect(result.ok).toBe(true);
    expect(result.status.hasToken === undefined || !result.status.token).toBe(true);
  });

  it("login ocorre após confirmação de subscription", async () => {
    const order = [];
    const api = createMockSdk({
      optInImpl: async (state, listeners) => {
        order.push("optin");
        state.optedIn = true;
        state.id = "sub-o";
        state.token = "tok-o";
        listeners.change.forEach((fn) =>
          fn({
            previous: {},
            current: { optedIn: true, id: "sub-o", token: "tok-o" },
          })
        );
      },
    });
    api.login = jest.fn(async () => {
      order.push("login");
    });
    __forceOneSignalReadyForTests(api);
    await enableOneSignalPushSubscription({ user: { id: 55 } });
    expect(order.indexOf("optin")).toBeLessThan(order.indexOf("login"));
    const tl = getPushDiagnosticTimeline();
    const optIdx = tl.findIndex((e) => e.name === "optin_resolved");
    const loginIdx = tl.findIndex(
      (e) => e.name === "login_started" || e.name === "identity_login_started"
    );
    expect(optIdx).toBeGreaterThanOrEqual(0);
    expect(loginIdx).toBeGreaterThan(optIdx);
  });

  it("mesmo external ID em Chrome e Firefox não sobrescreve localmente", async () => {
    const chromeApi = createMockSdk({
      optedIn: true,
      id: "chrome-sub-id",
      token: "chrome-tok",
    });
    __forceOneSignalReadyForTests(chromeApi);
    await enableOneSignalPushSubscription({ user: { id: 100 } });
    expect(chromeApi.login).toHaveBeenCalledWith("100");
    const chromeId = getOneSignalPushStatus().subscriptionId;

    await oneSignalLogout();
    expect(chromeApi.logout).toHaveBeenCalled();
    // Logout não chama optOut — inscrição física preservada no mock
    expect(chromeApi.User.PushSubscription.optedIn).toBe(true);
    expect(chromeApi.state.id).toBe("chrome-sub-id");

    __resetOneSignalServiceForTests();
    openApiModule.openApi.get.mockResolvedValue({
      data: {
        onesignalEnabled: true,
        onesignalAppId: "app-id-test",
        onesignalEnvironment: "development",
      },
    });
    const firefoxApi = createMockSdk({
      optedIn: true,
      id: "firefox-sub-id",
      token: "firefox-tok",
    });
    __forceOneSignalReadyForTests(firefoxApi);
    await enableOneSignalPushSubscription({ user: { id: 100 } });
    expect(firefoxApi.login).toHaveBeenCalledWith("100");
    expect(getOneSignalPushStatus().subscriptionId).toBe("firefox-sub-id");
    expect(chromeId).toBe("chrome-sub-id");
    expect(chromeId).not.toBe(getOneSignalPushStatus().subscriptionId);
  });

  it("worker path/scope canónicos e sem unregister", () => {
    expect(getOneSignalServiceWorkerPath()).toBe("/OneSignalSDKWorker.js");
    expect(getOneSignalServiceWorkerScope()).toBe("/push/onesignal/");
    const mod = require("../oneSignalWorkerTransition");
    expect(mod.unregisterLegacyOneSignalRootWorkers).toBeUndefined();
  });

  it("logout não executa optOut", async () => {
    const api = createMockSdk({
      optedIn: true,
      id: "s1",
      token: "t1",
    });
    api.User.PushSubscription.optOut = jest.fn();
    __forceOneSignalReadyForTests(api);
    await oneSignalLogout();
    expect(api.logout).toHaveBeenCalled();
    expect(api.User.PushSubscription.optOut).not.toHaveBeenCalled();
  });

  it("exposição em produção só com Super Admin supportMode ou flag", () => {
    process.env.NODE_ENV = "production";
    exposeOneSignalPushDiagnosticsGlobal({ id: 1, profile: "user" });
    expect(window.__atendechatOneSignalDiagnostics).toBeUndefined();

    expect(
      canExposeOneSignalDiagnostics({ super: true, supportMode: true })
    ).toBe(true);
    exposeOneSignalPushDiagnosticsGlobal({ super: true, supportMode: true });
    expect(typeof window.__atendechatOneSignalDiagnostics).toBe("function");

    delete window.__atendechatOneSignalDiagnostics;
    localStorage.setItem(ONESIGNAL_DIAG_FLAG_KEY, "1");
    expect(canExposeOneSignalDiagnostics({ id: 2 })).toBe(true);
  });

  it("buildOneSignalPushDiagnostics nunca inclui secrets", async () => {
    const payload = await buildOneSignalPushDiagnostics({
      status: {
        optedIn: true,
        subscriptionId: "secret-sub-id-abcdefgh",
        token: "secret-token-full-value",
        externalUserId: "42",
        domainState: "subscribed",
      },
      sdkLoaded: true,
      initialized: true,
      externalIdExpected: "42",
      subscriptionWaitMs: 15000,
      permissionWaitMs: 120000,
    });
    const json = JSON.stringify(payload);
    expect(json).not.toContain("secret-token-full-value");
    expect(json).not.toContain("secret-sub-id-abcdefgh");
    expect(json).not.toMatch(/restApiKey/i);
    expect(json).not.toMatch(/\"token\":/);
    expect(payload.timeouts.subscriptionWaitMs).toBe(15000);
    expect(payload.note).toMatch(/Subscription IDs distintos/i);
  });

  it("PushManager nativo ausente sem OneSignal ID é distinguível no diag", async () => {
    const api = createMockSdk({ optedIn: true, id: null, token: null });
    __forceOneSignalReadyForTests(api);
    global.Notification.permission = "granted";
    const diag = await getOneSignalPushDiagnostics();
    expect(diag.optedIn).toBe(true);
    expect(diag.hasSubscriptionId).toBe(false);
    expect(diag.oneSignalIdPresent).toBe(false);
    expect(Array.isArray(diag.workers)).toBe(true);
  });
});
