import {
  AUTH_LOGOUT_BROADCAST_KEY,
  AUTH_STORAGE_KEYS,
  broadcastAuthLogout,
  clearAuthCredentialsFromStorage,
  clearCurrentUserNotificationCache,
  clearNotificationSessionArtifacts,
  isForeignTabLogoutEvent,
  withTimeout,
} from "../authSessionCleanup";
import {
  forceStopNotificationTabLeader,
  initNotificationTabLeader,
  isNotificationTabLeader,
  __resetNotificationTabLeaderForTests,
} from "../notificationTabLeader";
import { buildGlobalNotificationsStorageKey } from "../globalNotificationsStorage";

describe("authSessionCleanup", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    __resetNotificationTabLeaderForTests();
  });

  afterEach(() => {
    __resetNotificationTabLeaderForTests();
  });

  it("remove credenciais de autenticação sem apagar chaves alheias", () => {
    localStorage.setItem("token", JSON.stringify("abc"));
    localStorage.setItem("companyId", "9");
    localStorage.setItem("userId", "3");
    localStorage.setItem("themePreference", "dark");
    clearAuthCredentialsFromStorage();
    AUTH_STORAGE_KEYS.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
    });
    expect(localStorage.getItem("themePreference")).toBe("dark");
  });

  it("limpa cache de notificações do usuário atual", () => {
    localStorage.setItem("userId", "11");
    localStorage.setItem("companyId", "22");
    const key = buildGlobalNotificationsStorageKey("11", "22");
    sessionStorage.setItem(key, JSON.stringify([{ id: "1", type: "whatsapp", title: "x" }]));
    clearCurrentUserNotificationCache();
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("broadcast de logout e detecção entre abas", () => {
    broadcastAuthLogout();
    expect(localStorage.getItem(AUTH_LOGOUT_BROADCAST_KEY)).toBeTruthy();
    expect(
      isForeignTabLogoutEvent({
        key: AUTH_LOGOUT_BROADCAST_KEY,
        newValue: "123",
      })
    ).toBe(true);
    expect(
      isForeignTabLogoutEvent({
        key: "token",
        oldValue: "\"t\"",
        newValue: null,
      })
    ).toBe(true);
    expect(
      isForeignTabLogoutEvent({
        key: "unrelated",
        newValue: "1",
      })
    ).toBe(false);
  });

  it("withTimeout rejeita quando a promise não resolve", async () => {
    await expect(
      withTimeout(new Promise(() => {}), 20, "logout_timeout")
    ).rejects.toThrow("logout_timeout");
  });

  it("withTimeout resolve quando a promise completa a tempo", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("encerra líder de notificação e permite reinício após logout", () => {
    const stop = initNotificationTabLeader();
    expect(isNotificationTabLeader()).toBe(true);
    clearNotificationSessionArtifacts();
    expect(localStorage.getItem("atendechat:notification-tab-leader")).toBeNull();
    forceStopNotificationTabLeader();
    const stop2 = initNotificationTabLeader();
    expect(typeof stop2).toBe("function");
    stop();
    stop2();
  });
});
