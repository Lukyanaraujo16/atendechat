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
    optOut: jest.fn(async () => {}),
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

  it("permission default concedida no optIn confirma id e token", async () => {
    const api = createMockSdk({
      optInImpl: async (state) => {
        global.Notification.permission = "granted";
        state.optedIn = true;
        state.id = "sub-from-default";
        state.token = "tok-from-default";
      },
    });
    __forceOneSignalReadyForTests(api);
    global.Notification.permission = "default";

    const result = await enableOneSignalPushSubscription({ user: { id: 8 } });
    expect(result.ok).toBe(true);
    expect(result.domainState).toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
    expect(getOneSignalPushStatus().subscriptionId).toBe("sub-from-default");
    expect(getOneSignalPushStatus().subscribing).toBe(false);
  });

  it("permission granted recebe a subscription depois do optIn", async () => {
    const api = createMockSdk({
      optInImpl: (state) =>
        new Promise((resolve) => {
          setTimeout(() => {
            state.optedIn = true;
            state.id = "sub-later";
            state.token = "tok-later";
            resolve();
          }, 25);
        }),
    });
    __forceOneSignalReadyForTests(api);
    global.Notification.permission = "granted";

    const result = await enableOneSignalPushSubscription({ user: { id: 4 } });
    expect(result.ok).toBe(true);
    expect(result.domainState).toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
    expect(getOneSignalPushStatus().subscriptionId).toBe("sub-later");
  });

  it("conclui pelo polling estável sem esperar o timeout do optIn pendente", async () => {
    __setPushWaitMsForTests(80, 5000, 80);
    const api = createMockSdk({
      optInImpl: () => new Promise(() => {}),
    });
    __forceOneSignalReadyForTests(api);
    setTimeout(() => {
      api.state.optedIn = true;
      api.state.id = "sub-poll";
      api.state.token = "tok-poll";
    }, 20);

    const started = Date.now();
    const result = await enableOneSignalPushSubscription({ user: { id: 6 } });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.ok).toBe(true);
    expect(result.domainState).toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
    expect(getOneSignalPushStatus().subscriptionId).toBe("sub-poll");
    expect(getOneSignalPushStatus().subscribing).toBe(false);
  });

  it("optedIn sem id nem token não conclui", async () => {
    const api = createMockSdk({
      optInImpl: async (state) => {
        state.optedIn = true;
        state.id = null;
        state.token = null;
      },
    });
    __forceOneSignalReadyForTests(api);
    global.Notification.permission = "granted";

    const result = await enableOneSignalPushSubscription({ user: { id: 13 } });
    expect(result.ok).toBe(false);
    expect(result.domainState).not.toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
    expect(getOneSignalPushStatus().subscribing).toBe(false);
  });

  it("não aceita o primeiro snapshot transitório", async () => {
    const api = createMockSdk({
      optInImpl: async (state) => {
        state.optedIn = true;
        state.id = "transient-id";
        state.token = "transient-token";
        setTimeout(() => {
          state.id = "stable-id";
          state.token = "stable-token";
        }, 8);
      },
    });
    __forceOneSignalReadyForTests(api);

    const result = await enableOneSignalPushSubscription({ user: { id: 15 } });
    expect(result.ok).toBe(true);
    expect(getOneSignalPushStatus().subscriptionId).toBe("stable-id");
    expect(result.domainState).toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
  });

  it("rejeição do optIn limpa subscribing", async () => {
    const api = createMockSdk({
      optInImpl: async () => {
        throw new Error("optin boom");
      },
    });
    __forceOneSignalReadyForTests(api);

    const result = await enableOneSignalPushSubscription({ user: { id: 16 } });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("opt_in_failed");
    expect(getOneSignalPushStatus().subscribing).toBe(false);
    expect(api.User.PushSubscription.optOut).not.toHaveBeenCalled();
  });

  it("timeout do optIn limpa subscribing", async () => {
    __setPushWaitMsForTests(40, 60, 40);
    const api = createMockSdk({
      optInImpl: () => new Promise(() => {}),
    });
    __forceOneSignalReadyForTests(api);

    const started = Date.now();
    const result = await enableOneSignalPushSubscription({ user: { id: 17 } });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("opt_in_timeout");
    expect(getOneSignalPushStatus().subscribing).toBe(false);
  });

  it("erro de init limpa subscribing", async () => {
    const append = jest.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node && node.tagName === "SCRIPT") {
        setTimeout(() => {
          if (typeof node.onerror === "function") node.onerror();
        }, 0);
      }
      return node;
    });

    const result = await enableOneSignalPushSubscription({ user: { id: 18 } });
    append.mockRestore();
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("init_failed");
    expect(getOneSignalPushStatus().subscribing).toBe(false);
  });

  it("erro de push-config limpa subscribing", async () => {
    openApiModule.openApi.get.mockRejectedValue(new Error("network"));
    const result = await enableOneSignalPushSubscription({ user: { id: 19 } });
    expect(result.ok).toBe(false);
    expect(getOneSignalPushStatus().subscribing).toBe(false);
  });

  it("login que rejeita preserva a subscription e encerra subscribing", async () => {
    const api = createMockSdk();
    api.login.mockRejectedValue(new Error("login fail"));
    __forceOneSignalReadyForTests(api);

    const result = await enableOneSignalPushSubscription({ user: { id: 20 } });
    expect(result.ok).toBe(true);
    expect(result.domainState).toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
    expect(getOneSignalPushStatus().subscriptionId).toBe("sub-confirmed");
    expect(getOneSignalPushStatus().subscribing).toBe(false);
    expect(api.User.PushSubscription.optOut).not.toHaveBeenCalled();
    expect(api.logout).not.toHaveBeenCalled();
  });

  it("login que nunca resolve estoura timeout e encerra subscribing", async () => {
    __setPushWaitMsForTests(40, 80, 50);
    const api = createMockSdk({
      optInImpl: async (state) => {
        state.optedIn = true;
        state.id = "sub-login-hang";
        state.token = "tok-login-hang";
      },
    });
    api.login.mockImplementation(() => new Promise(() => {}));
    __forceOneSignalReadyForTests(api);

    const started = Date.now();
    const result = await enableOneSignalPushSubscription({ user: { id: 21 } });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.ok).toBe(true);
    expect(result.domainState).toBe(PUSH_DOMAIN_STATES.SUBSCRIBED);
    expect(getOneSignalPushStatus().subscribing).toBe(false);
    expect(api.User.PushSubscription.optOut).not.toHaveBeenCalled();
  });

  it("rejeição tardia do optIn não fica sem tratamento depois do polling", async () => {
    const unhandled = jest.fn();
    const onUnhandled = (reason) => unhandled(reason);
    process.on("unhandledRejection", onUnhandled);
    let rejectOptIn;
    const api = createMockSdk({
      optInImpl: () =>
        new Promise((_, reject) => {
          rejectOptIn = reject;
        }),
    });
    __forceOneSignalReadyForTests(api);
    setTimeout(() => {
      api.state.optedIn = true;
      api.state.id = "sub-race-poll";
      api.state.token = "tok-race-poll";
    }, 15);

    const result = await enableOneSignalPushSubscription({ user: { id: 23 } });
    expect(result.ok).toBe(true);
    rejectOptIn(new Error("late optIn rejection"));
    await new Promise((r) => setTimeout(r, 30));
    process.off("unhandledRejection", onUnhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(api.User.PushSubscription.optOut).not.toHaveBeenCalled();
    expect(getOneSignalPushStatus().subscribing).toBe(false);
  });
});
