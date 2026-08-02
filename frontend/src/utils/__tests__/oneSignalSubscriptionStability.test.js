/**
 * Estabilidade da subscription Firefox (Fase 2.13F).
 */
import {
  classifyInvalidTokenDeviceTypeError,
  hashSensitiveValue,
  subscriptionSnapshotSignature,
  waitForStableSubscriptionSnapshot,
  __resetStabilityStateForTests,
  __setStabilityTimingForTests,
  getSnapshotChangesCount,
} from "../oneSignalSubscriptionStability";
import {
  __forceOneSignalReadyForTests,
  __resetOneSignalServiceForTests,
  __setPushWaitMsForTests,
  enableOneSignalPushSubscription,
  getOneSignalPushDiagnostics,
  oneSignalLogout,
  setOneSignalDeferLoginForProbe,
  syncOneSignalUser,
  completeOneSignalLoginAfterProbe,
  getOneSignalAnonymousProbe,
} from "../../services/oneSignalService";
import { getPushDiagnosticTimeline } from "../oneSignalPushDiagnostics";
import {
  getOneSignalServiceWorkerPath,
  getOneSignalServiceWorkerScope,
} from "../oneSignalServiceWorkerPaths";
import * as openApiModule from "../../services/api";

jest.mock("../../services/api", () => ({
  openApi: { get: jest.fn() },
  default: {},
}));

jest.mock("../../serviceWorkerRegistration", () => ({
  registerMinimalPwaServiceWorker: jest.fn(),
}));

function createMockSdk({
  optedIn = true,
  id = "sub-ff",
  token = "https://updates.push.services.mozilla.com/wpush/v2/abc",
  tokenSequence,
  enabledSequence,
  loginImpl,
} = {}) {
  const listeners = { change: [] };
  const state = {
    optedIn,
    id,
    token,
    enabled: true,
    notificationTypes: 1,
    seq: 0,
  };
  const PushSubscription = {
    get optedIn() {
      return state.optedIn;
    },
    get id() {
      return state.id;
    },
    get token() {
      if (Array.isArray(tokenSequence) && tokenSequence.length) {
        const idx = Math.min(state.seq, tokenSequence.length - 1);
        return tokenSequence[idx];
      }
      return state.token;
    },
    get enabled() {
      if (Array.isArray(enabledSequence) && enabledSequence.length) {
        const idx = Math.min(state.seq, enabledSequence.length - 1);
        return enabledSequence[idx];
      }
      return state.enabled;
    },
    get notificationTypes() {
      return state.notificationTypes;
    },
    optIn: jest.fn(async () => {
      state.optedIn = true;
      state.id = state.id || "sub-new";
      state.token = state.token || "tok-new";
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
    advanceToken() {
      state.seq += 1;
      listeners.change.forEach((fn) => fn({ current: { optedIn: true, id: state.id, token: PushSubscription.token } }));
    },
    User: { PushSubscription, addTags: jest.fn() },
    Notifications: {
      isPushSupported: jest.fn(() => true),
      requestPermission: jest.fn(async () => true),
      addEventListener: jest.fn(),
    },
    login: jest.fn(async (externalId) => {
      if (typeof loginImpl === "function") {
        return loginImpl(externalId);
      }
      return undefined;
    }),
    logout: jest.fn(async () => {}),
    init: jest.fn(async () => {}),
  };
}

describe("oneSignalSubscriptionStability (2.13F)", () => {
  const originalNotification = global.Notification;

  beforeEach(() => {
    __resetOneSignalServiceForTests();
    __setPushWaitMsForTests(40, 80);
    __setStabilityTimingForTests({
      pollMs: 20,
      requiredMatches: 3,
      minWindowMs: 40,
      timeoutMs: 400,
    });
    openApiModule.openApi.get.mockReset();
    openApiModule.openApi.get.mockResolvedValue({
      data: {
        onesignalEnabled: true,
        onesignalAppId: "app-id-test",
        onesignalEnvironment: "development",
      },
    });
    global.Notification = { permission: "granted" };
  });

  afterEach(() => {
    __resetOneSignalServiceForTests();
    __resetStabilityStateForTests();
    global.Notification = originalNotification;
  });

  it("hashSensitiveValue não devolve o valor completo", () => {
    const raw = "https://updates.push.services.mozilla.com/wpush/v2/SECRET";
    const h = hashSensitiveValue(raw);
    expect(h).not.toContain("SECRET");
    expect(h).toMatch(/^[0-9a-f]+:\d+$/);
  });

  it("classifica Invalid token format for device type iOS", () => {
    const c = classifyInvalidTokenDeviceTypeError({
      message: "Request failed",
      errors: [{ title: "Invalid `token` format for device type iOS" }],
    });
    expect(c.code).toBe("onesignal_invalid_token_device_type");
    expect(c.expectedType).toBe("FirefoxPush");
    expect(JSON.stringify(c)).not.toMatch(/mozilla\.com\/wpush/);
  });

  it("três snapshots iguais confirmam estabilidade", async () => {
    let tick = 0;
    const api = {
      User: {
        PushSubscription: {
          optedIn: true,
          id: "stable-id",
          token: "stable-token",
          enabled: true,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
      },
    };
    const snap = await waitForStableSubscriptionSnapshot(api, {
      pollMs: 5,
      requiredMatches: 3,
      minWindowMs: 10,
      timeoutMs: 200,
      now: () => {
        tick += 5;
        return tick;
      },
      sleep: async () => {},
    });
    expect(snap.effectivelySubscribed).toBe(true);
    expect(snap.signature).toBe(
      subscriptionSnapshotSignature(snap)
    );
  });

  it("change reinicia a janela de estabilidade", async () => {
    const listeners = [];
    let reads = 0;
    let token = "tok-a";
    const api = {
      User: {
        PushSubscription: {
          get optedIn() {
            return true;
          },
          get id() {
            return "id-1";
          },
          get token() {
            reads += 1;
            return token;
          },
          enabled: true,
          addEventListener: jest.fn((ev, fn) => {
            if (ev === "change") listeners.push(fn);
          }),
          removeEventListener: jest.fn(),
        },
      },
    };
    let now = 0;
    const p = waitForStableSubscriptionSnapshot(api, {
      pollMs: 5,
      requiredMatches: 3,
      minWindowMs: 15,
      timeoutMs: 500,
      now: () => now,
      sleep: async () => {
        now += 5;
        if (reads === 2) {
          token = "tok-b";
          listeners.forEach((fn) => fn({}));
        }
      },
    });
    const snap = await p;
    expect(snap.tokenHash).toBe(hashSensitiveValue("tok-b"));
    expect(getSnapshotChangesCount()).toBeGreaterThanOrEqual(1);
  });

  it("timeout sem estabilidade", async () => {
    let flip = false;
    const api = {
      User: {
        PushSubscription: {
          get optedIn() {
            return true;
          },
          get id() {
            return "id-x";
          },
          get token() {
            flip = !flip;
            return flip ? "tok-1" : "tok-2";
          },
          enabled: true,
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
      },
    };
    let now = 0;
    await expect(
      waitForStableSubscriptionSnapshot(api, {
        pollMs: 5,
        requiredMatches: 5,
        minWindowMs: 100,
        timeoutMs: 40,
        now: () => now,
        sleep: async () => {
          now += 10;
        },
      })
    ).rejects.toThrow("subscription_stability_timeout");
  });

  it("login só depois de estabilidade (token muda duas vezes)", async () => {
    const order = [];
    let seq = 0;
    const tokens = ["tok-a", "tok-b", "tok-stable", "tok-stable", "tok-stable", "tok-stable"];
    const api = createMockSdk({
      tokenSequence: tokens,
      loginImpl: async () => {
        order.push("login");
      },
    });
    api.User.addTags = jest.fn(() => {
      order.push("tags");
    });
    // Avança sequência a cada leitura via getter — force progress
    const originalTokenDesc = Object.getOwnPropertyDescriptor(
      api.User.PushSubscription,
      "token"
    );
    Object.defineProperty(api.User.PushSubscription, "token", {
      configurable: true,
      get() {
        const t = tokens[Math.min(seq, tokens.length - 1)];
        seq += 1;
        return t;
      },
    });
    __forceOneSignalReadyForTests(api);
    __setStabilityTimingForTests({
      pollMs: 10,
      requiredMatches: 2,
      minWindowMs: 20,
      timeoutMs: 800,
    });
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    expect(order[0]).toBe("login");
    expect(order[1]).toBe("tags");
    expect(api.login).toHaveBeenCalledTimes(1);
    expect(api.User.addTags).toHaveBeenCalledTimes(1);
    if (originalTokenDesc) {
      Object.defineProperty(api.User.PushSubscription, "token", originalTokenDesc);
    }
  });

  it("enabled oscila e só login após estabilizar", async () => {
    let n = 0;
    const enabledSeq = [true, false, true, true, true, true];
    const api = createMockSdk({
      loginImpl: async () => {},
    });
    Object.defineProperty(api.User.PushSubscription, "enabled", {
      configurable: true,
      get() {
        const v = enabledSeq[Math.min(n, enabledSeq.length - 1)];
        n += 1;
        return v;
      },
    });
    __forceOneSignalReadyForTests(api);
    __setStabilityTimingForTests({
      pollMs: 10,
      requiredMatches: 2,
      minWindowMs: 15,
      timeoutMs: 600,
    });
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    expect(api.login).toHaveBeenCalledWith("25");
  });

  it("chamadas concorrentes reutilizam Promise de estabilidade/login", async () => {
    let release;
    const api = createMockSdk({
      loginImpl: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    });
    __forceOneSignalReadyForTests(api);
    __setStabilityTimingForTests({
      pollMs: 5,
      requiredMatches: 2,
      minWindowMs: 10,
      timeoutMs: 500,
    });
    const user = { id: 25, companyId: 1, profile: "admin" };
    const p1 = syncOneSignalUser(user);
    const p2 = syncOneSignalUser(user);
    const p3 = enableOneSignalPushSubscription({ user });
    await new Promise((r) => setTimeout(r, 80));
    expect(api.login).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([p1, p2, p3]);
    expect(api.login).toHaveBeenCalledTimes(1);
    expect(api.User.addTags).toHaveBeenCalledTimes(1);
  });

  it("erro HTTP 400 iOS fica no diagnóstico", async () => {
    const api = createMockSdk({
      loginImpl: async () => {
        const err = new Error("Invalid `token` format for device type iOS");
        err.errors = [{ title: "Invalid `token` format for device type iOS" }];
        throw err;
      },
    });
    __forceOneSignalReadyForTests(api);
    __setStabilityTimingForTests({
      pollMs: 5,
      requiredMatches: 2,
      minWindowMs: 10,
      timeoutMs: 300,
    });
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    const tl = getPushDiagnosticTimeline();
    expect(
      tl.some((e) => e.name === "onesignal_invalid_token_device_type")
    ).toBe(true);
    const diag = await getOneSignalPushDiagnostics();
    const json = JSON.stringify(diag);
    expect(json).not.toContain("wpush/v2/");
    expect(json).not.toMatch(/eyJ[A-Za-z0-9_-]+\./);
  });

  it("Chrome imediato continua: login com external id do usuário", async () => {
    const api = createMockSdk({
      id: "chrome-sub",
      token: "chrome-fcm-token",
    });
    __forceOneSignalReadyForTests(api);
    await enableOneSignalPushSubscription({
      user: { id: 25, companyId: 1, profile: "admin" },
    });
    expect(api.login).toHaveBeenCalledWith("25");
    expect(api.User.addTags).toHaveBeenCalledTimes(1);
  });

  it("probe anónimo (dev) captura antes do login", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);
    const user = {
      id: 25,
      companyId: 1,
      profile: "admin",
      super: true,
      supportMode: true,
    };
    expect(setOneSignalDeferLoginForProbe(true, user)).toBe(true);
    await syncOneSignalUser(user);
    expect(api.login).not.toHaveBeenCalled();
    const probe = getOneSignalAnonymousProbe();
    expect(probe.phase).toBe("before_login");
    await completeOneSignalLoginAfterProbe(user);
    expect(api.login).toHaveBeenCalledWith("25");
  });

  it("logout invalida e workers/scopes intactos", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    await oneSignalLogout();
    expect(api.logout).toHaveBeenCalled();
    expect(getOneSignalServiceWorkerPath()).toBe("/OneSignalSDKWorker.js");
    expect(getOneSignalServiceWorkerScope()).toBe("/push/onesignal/");
    const mod = require("../oneSignalWorkerTransition");
    expect(mod.unregisterLegacyOneSignalRootWorkers).toBeUndefined();
  });

  it("nenhuma manipulação direta de device type no serviço", () => {
    const src = require("fs").readFileSync(
      require("path").join(__dirname, "../../services/oneSignalService.js"),
      "utf8"
    );
    expect(src).not.toMatch(/device_type\s*=/);
    expect(src).not.toMatch(/FirefoxPush\s*=/);
    expect(src).not.toMatch(/api\.onesignal\.com\/apps/);
  });
});
