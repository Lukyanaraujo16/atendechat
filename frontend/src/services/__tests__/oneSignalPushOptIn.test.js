/**
 * Contrato OneSignal Web SDK v16 — enable/opt-in/confirmação (Fase 2.12).
 */
import {
  __forceOneSignalReadyForTests,
  __resetOneSignalServiceForTests,
  __setPushWaitMsForTests,
  enableOneSignalPushSubscription,
  getOneSignalPushStatus,
  oneSignalLogout,
  subscribeOneSignalPushStatus,
} from "../oneSignalService";
import { PUSH_DOMAIN_STATES } from "../../utils/oneSignalPushDomain";
import * as openApiModule from "../api";

jest.mock("../api", () => ({
  openApi: {
    get: jest.fn(),
  },
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
  const state = {
    optedIn,
    id,
    token,
  };

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
          current: {
            optedIn: true,
            id: state.id,
            token: state.token,
          },
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
    User: {
      PushSubscription,
      addTags: jest.fn(),
    },
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

describe("enableOneSignalPushSubscription", () => {
  const originalNotification = global.Notification;

  beforeEach(() => {
    __resetOneSignalServiceForTests();
    __setPushWaitMsForTests(50, 100);
    openApiModule.openApi.get.mockReset();
    openApiModule.openApi.get.mockResolvedValue({
      data: {
        onesignalEnabled: true,
        onesignalAppId: "app-id-test",
        onesignalEnvironment: "development",
      },
    });
    global.Notification = { permission: "default" };
  });

  afterEach(() => {
    __resetOneSignalServiceForTests();
    global.Notification = originalNotification;
  });

  it("falha quando push desabilitado globalmente", async () => {
    openApiModule.openApi.get.mockResolvedValue({
      data: {
        onesignalEnabled: false,
        onesignalAppId: "",
        onesignalEnvironment: "production",
      },
    });
    const result = await enableOneSignalPushSubscription({ user: { id: 1 } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("not_configured");
  });

  it("falha quando App ID ausente", async () => {
    openApiModule.openApi.get.mockResolvedValue({
      data: {
        onesignalEnabled: true,
        onesignalAppId: "",
        onesignalEnvironment: "production",
      },
    });
    const result = await enableOneSignalPushSubscription({ user: { id: 1 } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("not_configured");
  });

  it("permission denied não marca sucesso nem chama optIn", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);
    global.Notification.permission = "denied";

    const result = await enableOneSignalPushSubscription({ user: { id: 9 } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("permission_denied");
    expect(api.User.PushSubscription.optIn).not.toHaveBeenCalled();
  });

  it("opt-in concluído confirma subscription e associa identidade", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);

    const updates = [];
    const unsubscribe = subscribeOneSignalPushStatus((s) => updates.push(s.domainState));

    const result = await enableOneSignalPushSubscription({
      user: { id: 42, companyId: 7, profile: "admin", queues: [{ id: 1 }] },
    });

    expect(result.ok).toBe(true);
    expect(result.domainState).toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
    expect(api.User.PushSubscription.optIn).toHaveBeenCalled();
    expect(api.login).toHaveBeenCalledWith("42");
    expect(api.User.addTags).toHaveBeenCalled();
    expect(getOneSignalPushStatus().subscriptionId).toBe("sub-confirmed");
    expect(updates).toContain(PUSH_DOMAIN_STATES.SUBSCRIBING);
    expect(updates).toContain(PUSH_DOMAIN_STATES.SUBSCRIBED);

    unsubscribe();
  });

  it("permission granted sem subscription não marca sucesso", async () => {
    const api = createMockSdk({
      optInImpl: async (state) => {
        state.optedIn = false;
        state.id = null;
        state.token = null;
      },
    });
    __forceOneSignalReadyForTests(api);
    global.Notification.permission = "granted";

    const result = await enableOneSignalPushSubscription({ user: { id: 3 } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("subscription_missing_after_permission");
    expect(result.domainState).not.toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
  });

  it("subscription já ativa retorna sucesso sem novo prompt", async () => {
    const api = createMockSdk({
      optedIn: true,
      id: "existing",
      token: "tok",
    });
    __forceOneSignalReadyForTests(api);
    global.Notification.permission = "granted";

    const result = await enableOneSignalPushSubscription({ user: { id: 5 } });
    expect(result.ok).toBe(true);
    expect(api.User.PushSubscription.optIn).not.toHaveBeenCalled();
    expect(api.login).toHaveBeenCalledWith("5");
  });

  it("logout limpa identidade sem destruir opt-in físico", async () => {
    const api = createMockSdk({
      optedIn: true,
      id: "sub-1",
      token: "tok-1",
    });
    __forceOneSignalReadyForTests(api);
    await oneSignalLogout();
    expect(api.logout).toHaveBeenCalled();
    expect(getOneSignalPushStatus().externalUserId).toBeNull();
  });

  it("cliques concorrentes compartilham a mesma promise", async () => {
    let resolveOptIn;
    const api = createMockSdk({
      optInImpl: () =>
        new Promise((resolve) => {
          resolveOptIn = () => {
            api.state.optedIn = true;
            api.state.id = "sub-race";
            api.state.token = "tok-race";
            api.listeners.change.forEach((fn) =>
              fn({
                previous: {},
                current: {
                  optedIn: true,
                  id: "sub-race",
                  token: "tok-race",
                },
              })
            );
            resolve();
          };
        }),
    });
    __forceOneSignalReadyForTests(api);

    const p1 = enableOneSignalPushSubscription({ user: { id: 1 } });
    const p2 = enableOneSignalPushSubscription({ user: { id: 1 } });
    expect(p1).toBe(p2);

    await new Promise((r) => setTimeout(r, 10));
    expect(typeof resolveOptIn).toBe("function");
    resolveOptIn();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(api.User.PushSubscription.optIn).toHaveBeenCalledTimes(1);
  });

  it("não expõe REST API Key no fluxo público", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);
    await enableOneSignalPushSubscription({ user: { id: 1 } });
    const response = await openApiModule.openApi.get.mock.results[0].value;
    expect(JSON.stringify(response)).not.toMatch(/restApiKey/i);
    expect(JSON.stringify(response)).not.toMatch(/api_key/i);
  });

  it("login seguinte não herda external id do usuário anterior", async () => {
    const api = createMockSdk({
      optedIn: true,
      id: "sub-1",
      token: "tok-1",
    });
    __forceOneSignalReadyForTests(api);
    await enableOneSignalPushSubscription({ user: { id: 11 } });
    expect(api.login).toHaveBeenCalledWith("11");
    await oneSignalLogout();
    expect(getOneSignalPushStatus().externalUserId).toBeNull();
    await enableOneSignalPushSubscription({ user: { id: 22 } });
    expect(api.login).toHaveBeenLastCalledWith("22");
    expect(getOneSignalPushStatus().externalUserId).toBe("22");
  });
});
