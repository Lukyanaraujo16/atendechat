import axios from "axios";
import {
  attachAuthApiInterceptors,
  getAuthLoggingOut,
  setAuthLoggingOut,
  __resetAuthInterceptorStateForTests,
} from "../authApiInterceptors";

function createTestApi(handler) {
  const api = axios.create({ baseURL: "http://localhost" });
  api.defaults.adapter = async (config) => handler(config);
  attachAuthApiInterceptors(api);
  return api;
}

function ok(config, data = {}) {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  };
}

function httpError(config, status, data = {}) {
  const error = new Error(`Request failed with status code ${status}`);
  error.config = config;
  error.response = {
    status,
    data,
    headers: {},
    config,
    statusText: String(status),
  };
  error.isAxiosError = true;
  return Promise.reject(error);
}

describe("auth logout interceptors", () => {
  beforeEach(() => {
    __resetAuthInterceptorStateForTests();
    localStorage.clear();
    setAuthLoggingOut(false);
  });

  afterEach(() => {
    __resetAuthInterceptorStateForTests();
    setAuthLoggingOut(false);
  });

  it("não tenta refresh durante logout (403)", async () => {
    localStorage.setItem("token", JSON.stringify("access-old"));
    setAuthLoggingOut(true);
    let refreshCalls = 0;
    const api = createTestApi((config) => {
      if (String(config.url).includes("/auth/refresh_token")) {
        refreshCalls += 1;
        return ok(config, { token: "access-new" });
      }
      return httpError(config, 403, { error: "ERR_SESSION_EXPIRED" });
    });

    await expect(api.get("/tickets")).rejects.toBeTruthy();
    expect(refreshCalls).toBe(0);
    expect(localStorage.getItem("token")).toBe(JSON.stringify("access-old"));
    expect(getAuthLoggingOut()).toBe(true);
  });

  it("não tenta refresh no endpoint /auth/logout", async () => {
    localStorage.setItem("token", JSON.stringify("access-old"));
    let refreshCalls = 0;
    const api = createTestApi((config) => {
      if (String(config.url).includes("/auth/refresh_token")) {
        refreshCalls += 1;
        return ok(config, { token: "access-new" });
      }
      if (String(config.method).toLowerCase() === "delete") {
        return httpError(config, 401, { error: "ERR_SESSION_EXPIRED" });
      }
      return ok(config);
    });

    await expect(api.delete("/auth/logout")).rejects.toBeTruthy();
    expect(refreshCalls).toBe(0);
  });

  it("setAuthLoggingOut rejeita fila de refresh pendente", async () => {
    localStorage.setItem("token", JSON.stringify("access-old"));
    let resolveRefresh;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });
    const api = createTestApi((config) => {
      if (String(config.url).includes("/auth/refresh_token")) {
        return refreshPromise.then(() => ok(config, { token: "access-new" }));
      }
      return httpError(config, 403, { error: "ERR_SESSION_EXPIRED" });
    });

    const p1 = api.get("/a").catch((e) => e);
    await Promise.resolve();
    const p2 = api.get("/b").catch((e) => e);
    await Promise.resolve();
    setAuthLoggingOut(true);
    resolveRefresh();
    const [e1, e2] = await Promise.all([p1, p2]);
    expect(e1).toBeTruthy();
    expect(e2).toBeTruthy();
  });
});
