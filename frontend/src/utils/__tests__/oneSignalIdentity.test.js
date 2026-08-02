/**
 * Identidade OneSignal por utilizador (Fase 2.13E).
 */
import {
  assertExternalIdIsNotCompanyId,
  buildOneSignalIdentityTags,
  buildOneSignalIdentitySyncKey,
  describeOneSignalSupportModeIdentity,
  oneSignalTagsSignature,
  resolveOneSignalCompanyIdTag,
  resolveOneSignalExternalId,
} from "../oneSignalIdentity";
import {
  __forceOneSignalReadyForTests,
  __resetOneSignalServiceForTests,
  __setPushWaitMsForTests,
  enableOneSignalPushSubscription,
  getOneSignalPushDiagnostics,
  getOneSignalPushStatus,
  oneSignalLogout,
  syncOneSignalUser,
} from "../../services/oneSignalService";
import { getPushDiagnosticTimeline } from "../oneSignalPushDiagnostics";
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
  id = "sub-chrome",
  token = "tok-chrome",
  loginImpl,
} = {}) {
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
      state.optedIn = true;
      state.id = state.id || "sub-new";
      state.token = state.token || "tok-new";
    }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  return {
    state,
    User: {
      PushSubscription,
      addTags: jest.fn(),
    },
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

describe("oneSignalIdentity contract (2.13E)", () => {
  it("user 25 / company 1 → external id 25, nunca 1", () => {
    const user = { id: 25, companyId: 1, profile: "admin", queues: [{ id: 3 }] };
    expect(resolveOneSignalExternalId(user)).toBe("25");
    expect(resolveOneSignalCompanyIdTag(user)).toBe("1");
    const tags = buildOneSignalIdentityTags(user, "25");
    expect(tags.user_id).toBe("25");
    expect(tags.company_id).toBe("1");
    expect(resolveOneSignalExternalId(user)).not.toBe(
      resolveOneSignalCompanyIdTag(user)
    );
  });

  it("user 26 / company 1 → external id 26", () => {
    expect(
      resolveOneSignalExternalId({ id: 26, companyId: 1, profile: "user" })
    ).toBe("26");
  });

  it("não resolve External ID a partir de companyId puro ou número", () => {
    expect(resolveOneSignalExternalId(1)).toBeNull();
    expect(resolveOneSignalExternalId("1")).toBeNull();
    expect(resolveOneSignalExternalId({ companyId: 1 })).toBeNull();
    expect(resolveOneSignalExternalId({ id: 1, companyId: 1 })).toBe("1");
  });

  it("tags signature é estável independente da ordem de construção", () => {
    const a = oneSignalTagsSignature({
      queue_ids: "1,2",
      profile: "admin",
      company_id: "1",
      user_id: "25",
    });
    const b = oneSignalTagsSignature({
      user_id: "25",
      company_id: "1",
      profile: "admin",
      queue_ids: "1,2",
    });
    expect(a).toBe(b);
  });

  it("queue_ids é determinístico (ordenado)", () => {
    const tags = buildOneSignalIdentityTags(
      { id: 25, companyId: 1, queues: [{ id: 9 }, { id: 2 }] },
      "25"
    );
    expect(tags.queue_ids).toBe("2,9");
  });

  it("supportMode não usa companyId do tenant como External ID", () => {
    const user = {
      id: 99,
      companyId: 1,
      supportMode: true,
      super: true,
      profile: "admin",
    };
    const desc = describeOneSignalSupportModeIdentity(user);
    expect(desc.sessionUserExternalId).toBe("99");
    expect(desc.selectedCompanyIdTag).toBe("1");
    expect(desc.usesTenantCompanyIdAsExternalId).toBe(false);
    expect(resolveOneSignalExternalId(user)).toBe("99");
  });

  it("sync key inclui app + external + subscription", () => {
    expect(
      buildOneSignalIdentitySyncKey({
        appId: "app",
        externalId: "25",
        subscriptionId: "sub-a",
      })
    ).toBe("app:25:sub-a");
  });

  it("assertExternalIdIsNotCompanyId documenta ambiguidade user=company", () => {
    const r = assertExternalIdIsNotCompanyId("1", "1");
    expect(r.ok).toBe(true);
    expect(r.reason).toBe("external_id_equals_company_id_ambiguous");
  });
});

describe("oneSignal identity sync single-flight (2.13E)", () => {
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
    global.Notification = { permission: "granted" };
  });

  afterEach(() => {
    __resetOneSignalServiceForTests();
    global.Notification = originalNotification;
  });

  it("userId 25/companyId 1 → login \"25\", nunca \"1\"", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);
    await enableOneSignalPushSubscription({
      user: { id: 25, companyId: 1, profile: "admin", queues: [{ id: 1 }] },
    });
    expect(api.login).toHaveBeenCalledWith("25");
    expect(api.login).not.toHaveBeenCalledWith("1");
    expect(api.User.addTags).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "25",
        company_id: "1",
        profile: "admin",
      })
    );
    expect(getOneSignalPushStatus().externalUserId).toBe("25");
  });

  it("Chrome e Firefox: mesmo External ID, subscriptions distintas", async () => {
    const chrome = createMockSdk({ id: "chrome-sub", token: "chrome-tok" });
    __forceOneSignalReadyForTests(chrome);
    await enableOneSignalPushSubscription({
      user: { id: 25, companyId: 1, profile: "admin" },
    });
    expect(chrome.login).toHaveBeenCalledWith("25");
    const chromeSub = getOneSignalPushStatus().subscriptionId;

    await oneSignalLogout();
    expect(chrome.logout).toHaveBeenCalled();
    expect(chrome.state.id).toBe("chrome-sub");

    __resetOneSignalServiceForTests();
    openApiModule.openApi.get.mockResolvedValue({
      data: {
        onesignalEnabled: true,
        onesignalAppId: "app-id-test",
        onesignalEnvironment: "development",
      },
    });
    const firefox = createMockSdk({ id: "firefox-sub", token: "firefox-tok" });
    __forceOneSignalReadyForTests(firefox);
    await enableOneSignalPushSubscription({
      user: { id: 25, companyId: 1, profile: "admin" },
    });
    expect(firefox.login).toHaveBeenCalledWith("25");
    expect(getOneSignalPushStatus().subscriptionId).toBe("firefox-sub");
    expect(chromeSub).toBe("chrome-sub");
    expect(chromeSub).not.toBe(getOneSignalPushStatus().subscriptionId);
  });

  it("quatro callers simultâneos → um login e uma atualização de tags", async () => {
    let releaseLogin;
    const api = createMockSdk({
      loginImpl: () =>
        new Promise((resolve) => {
          releaseLogin = resolve;
        }),
    });
    __forceOneSignalReadyForTests(api);
    const user = { id: 25, companyId: 1, profile: "admin", queues: [] };

    const p1 = syncOneSignalUser(user);
    const p2 = syncOneSignalUser(user);
    const p3 = syncOneSignalUser(user);
    const p4 = enableOneSignalPushSubscription({ user });

    // flush fetchPublicPushConfig + init antes do login
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(api.login).toHaveBeenCalledTimes(1);
    expect(api.login).toHaveBeenCalledWith("25");
    expect(typeof releaseLogin).toBe("function");
    releaseLogin();
    await Promise.all([p1, p2, p3, p4]);
    expect(api.login).toHaveBeenCalledTimes(1);
    expect(api.User.addTags).toHaveBeenCalledTimes(1);
  });

  it("login ocorre antes das tags", async () => {
    const order = [];
    const api = createMockSdk({
      loginImpl: async () => {
        order.push("login");
      },
    });
    api.User.addTags = jest.fn(() => {
      order.push("tags");
    });
    __forceOneSignalReadyForTests(api);
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    expect(order).toEqual(["login", "tags"]);
  });

  it("tags iguais não repetem PATCH", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);
    const user = { id: 25, companyId: 1, profile: "admin", queues: [{ id: 2 }] };
    await syncOneSignalUser(user);
    await syncOneSignalUser(user);
    await syncOneSignalUser(user);
    expect(api.login).toHaveBeenCalledTimes(1);
    expect(api.User.addTags).toHaveBeenCalledTimes(1);
  });

  it("mudança de tags gera uma atualização", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin", queues: [] });
    await syncOneSignalUser({
      id: 25,
      companyId: 1,
      profile: "admin",
      queues: [{ id: 5 }],
    });
    expect(api.login).toHaveBeenCalledTimes(2);
    expect(api.User.addTags).toHaveBeenCalledTimes(2);
    expect(api.User.addTags.mock.calls[1][0].queue_ids).toBe("5");
  });

  it("erro de login impede tags", async () => {
    const api = createMockSdk({
      loginImpl: async () => {
        throw new Error("http_400");
      },
    });
    __forceOneSignalReadyForTests(api);
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    expect(api.login).toHaveBeenCalledWith("25");
    expect(api.User.addTags).not.toHaveBeenCalled();
    const tl = getPushDiagnosticTimeline();
    expect(tl.some((e) => e.name === "identity_login_failed")).toBe(true);
  });

  it("retry após erro de login", async () => {
    let failOnce = true;
    const api = createMockSdk({
      loginImpl: async () => {
        if (failOnce) {
          failOnce = false;
          throw new Error("http_400");
        }
      },
    });
    __forceOneSignalReadyForTests(api);
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    expect(api.User.addTags).not.toHaveBeenCalled();
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    expect(api.login).toHaveBeenCalledTimes(2);
    expect(api.User.addTags).toHaveBeenCalledTimes(1);
  });

  it("logout invalida cache e utilizador B não herda A", async () => {
    const api = createMockSdk();
    __forceOneSignalReadyForTests(api);
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    expect(getOneSignalPushStatus().externalUserId).toBe("25");
    await oneSignalLogout();
    expect(getOneSignalPushStatus().externalUserId).toBeNull();
    await syncOneSignalUser({ id: 26, companyId: 1, profile: "user" });
    expect(api.login).toHaveBeenLastCalledWith("26");
    expect(getOneSignalPushStatus().externalUserId).toBe("26");
  });

  it("diagnóstico não expõe JWT/token/subscription completa", async () => {
    const api = createMockSdk({
      id: "full-subscription-id-secret",
      token: "full-push-token-secret-value",
    });
    __forceOneSignalReadyForTests(api);
    await syncOneSignalUser({ id: 25, companyId: 1, profile: "admin" });
    const diag = await getOneSignalPushDiagnostics();
    const json = JSON.stringify(diag);
    expect(json).not.toContain("full-push-token-secret-value");
    expect(json).not.toContain("full-subscription-id-secret");
    expect(json).not.toMatch(/eyJ[A-Za-z0-9_-]+\./);
    expect(diag.identitySync.lastExternalId).toBe("25");
  });
});
