/**
 * Fluxo de logout resiliente (useAuth.handleLogout) — simulação ponta a ponta
 * sem montar a árvore completa de providers.
 */

import {
  AUTH_LOGOUT_BROADCAST_KEY,
  AUTH_STORAGE_KEYS,
  broadcastAuthLogout,
  clearAuthCredentialsFromStorage,
  clearCurrentUserNotificationCache,
  clearNotificationSessionArtifacts,
  withTimeout,
} from "../../utils/authSessionCleanup";
import {
  setAuthLoggingOut,
  getAuthLoggingOut,
  __resetAuthInterceptorStateForTests,
} from "../../services/authApiInterceptors";

const PROFILES = [
  { label: "super admin", user: { id: 1, profile: "admin", super: true, companyId: null } },
  { label: "admin empresa", user: { id: 2, profile: "admin", super: false, companyId: 10 } },
  { label: "supervisor", user: { id: 3, profile: "supervisor", super: false, companyId: 10 } },
  { label: "usuário comum", user: { id: 4, profile: "user", super: false, companyId: 10 } },
];

async function runLogoutSequence({
  apiDelete,
  oneSignalLogout = async () => {},
  disconnectSession = jest.fn(),
  historyPush = jest.fn(),
  setLoading = jest.fn(),
  setIsAuth = jest.fn(),
  setUser = jest.fn(),
}) {
  if (getAuthLoggingOut()) return { skipped: true };
  setAuthLoggingOut(true);
  setLoading(true);

  try {
    try {
      await withTimeout(oneSignalLogout(), 50, "onesignal_logout_timeout");
    } catch {
      /* ignore */
    }
    try {
      await apiDelete();
    } catch {
      /* ignore */
    }
  } finally {
    broadcastAuthLogout();
    clearCurrentUserNotificationCache();
    clearAuthCredentialsFromStorage();
    clearNotificationSessionArtifacts();
    setIsAuth(false);
    setUser({});
    disconnectSession();
    setLoading(false);
    setAuthLoggingOut(false);
    historyPush("/login");
  }
  return { skipped: false };
}

describe("logout resilient sequence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    __resetAuthInterceptorStateForTests();
    setAuthLoggingOut(false);
  });

  afterEach(() => {
    __resetAuthInterceptorStateForTests();
    setAuthLoggingOut(false);
  });

  function seedSession(user) {
    localStorage.setItem("token", JSON.stringify(`tok-${user.id}`));
    localStorage.setItem("userId", String(user.id));
    if (user.companyId != null) {
      localStorage.setItem("companyId", String(user.companyId));
    }
  }

  function assertLoggedOut(historyPush, setLoading, setIsAuth) {
    AUTH_STORAGE_KEYS.forEach((key) => {
      expect(localStorage.getItem(key)).toBeNull();
    });
    expect(localStorage.getItem(AUTH_LOGOUT_BROADCAST_KEY)).toBeTruthy();
    expect(setIsAuth).toHaveBeenCalledWith(false);
    expect(setLoading).toHaveBeenLastCalledWith(false);
    expect(historyPush).toHaveBeenCalledWith("/login");
    expect(getAuthLoggingOut()).toBe(false);
  }

  PROFILES.forEach(({ label, user }) => {
    it(`logout bem-sucedido — ${label}`, async () => {
      seedSession(user);
      const historyPush = jest.fn();
      const setLoading = jest.fn();
      const setIsAuth = jest.fn();
      await runLogoutSequence({
        apiDelete: async () => ({ status: 200 }),
        historyPush,
        setLoading,
        setIsAuth,
        setUser: jest.fn(),
      });
      assertLoggedOut(historyPush, setLoading, setIsAuth);
    });
  });

  it("logout com endpoint 401 ainda limpa sessão local", async () => {
    seedSession(PROFILES[0].user);
    const historyPush = jest.fn();
    const setLoading = jest.fn();
    const setIsAuth = jest.fn();
    await runLogoutSequence({
      apiDelete: async () => {
        const err = new Error("401");
        err.response = { status: 401 };
        throw err;
      },
      historyPush,
      setLoading,
      setIsAuth,
    });
    assertLoggedOut(historyPush, setLoading, setIsAuth);
  });

  it("logout com endpoint 500 ainda limpa sessão local", async () => {
    seedSession(PROFILES[1].user);
    const historyPush = jest.fn();
    const setLoading = jest.fn();
    const setIsAuth = jest.fn();
    await runLogoutSequence({
      apiDelete: async () => {
        const err = new Error("500");
        err.response = { status: 500 };
        throw err;
      },
      historyPush,
      setLoading,
      setIsAuth,
    });
    assertLoggedOut(historyPush, setLoading, setIsAuth);
  });

  it("logout com timeout da API ainda limpa sessão e encerra loading", async () => {
    seedSession(PROFILES[2].user);
    const historyPush = jest.fn();
    const setLoading = jest.fn();
    const setIsAuth = jest.fn();
    await runLogoutSequence({
      apiDelete: () =>
        withTimeout(new Promise(() => {}), 30, "logout_api_timeout").catch((e) => {
          throw e;
        }),
      historyPush,
      setLoading,
      setIsAuth,
    });
    assertLoggedOut(historyPush, setLoading, setIsAuth);
  });

  it("logout offline (rede) ainda limpa sessão", async () => {
    seedSession(PROFILES[3].user);
    const historyPush = jest.fn();
    const setLoading = jest.fn();
    const setIsAuth = jest.fn();
    await runLogoutSequence({
      apiDelete: async () => {
        const err = new Error("Network Error");
        err.request = {};
        throw err;
      },
      historyPush,
      setLoading,
      setIsAuth,
    });
    assertLoggedOut(historyPush, setLoading, setIsAuth);
  });

  it("OneSignal lento não prende o logout", async () => {
    seedSession(PROFILES[0].user);
    const historyPush = jest.fn();
    const setLoading = jest.fn();
    const setIsAuth = jest.fn();
    await runLogoutSequence({
      oneSignalLogout: () => new Promise(() => {}),
      apiDelete: async () => ({ status: 200 }),
      historyPush,
      setLoading,
      setIsAuth,
    });
    assertLoggedOut(historyPush, setLoading, setIsAuth);
  });

  it("double-click: segunda chamada é ignorada enquanto flag ativa", async () => {
    seedSession(PROFILES[0].user);
    setAuthLoggingOut(true);
    const historyPush = jest.fn();
    const result = await runLogoutSequence({
      apiDelete: async () => ({ status: 200 }),
      historyPush,
    });
    expect(result.skipped).toBe(true);
    expect(historyPush).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeTruthy();
  });

  it("chama disconnectSession no cleanup", async () => {
    seedSession(PROFILES[1].user);
    const disconnectSession = jest.fn();
    await runLogoutSequence({
      apiDelete: async () => ({ status: 200 }),
      disconnectSession,
      historyPush: jest.fn(),
      setLoading: jest.fn(),
      setIsAuth: jest.fn(),
    });
    expect(disconnectSession).toHaveBeenCalled();
  });

  it("após logout, refresh da página não encontra token", async () => {
    seedSession(PROFILES[0].user);
    await runLogoutSequence({
      apiDelete: async () => ({ status: 200 }),
      historyPush: jest.fn(),
      setLoading: jest.fn(),
      setIsAuth: jest.fn(),
    });
    expect(localStorage.getItem("token")).toBeNull();
    // bootstrap do useAuth só chama refresh se houver token
    expect(Boolean(localStorage.getItem("token"))).toBe(false);
  });
});
