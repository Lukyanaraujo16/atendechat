import {
  APP_VERSION_STORAGE_KEY,
  buildVersionUrl,
  clearReloadGuard,
  fetchRemoteAppVersion,
  hasUpdate,
  isChunkLoadError,
  isLikelyUnsavedWork,
  markReloadAttempt,
  parseVersionPayload,
  readStoredAppVersion,
  writeStoredAppVersion,
  shouldBlockReloadLoop,
} from "../appVersion";

describe("appVersion", () => {
  let storage;
  let session;

  beforeEach(() => {
    storage = {
      data: {},
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(this.data, k)
          ? this.data[k]
          : null;
      },
      setItem(k, v) {
        this.data[k] = String(v);
      },
      removeItem(k) {
        delete this.data[k];
      },
    };
    session = {
      data: {},
      length: 0,
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(this.data, k)
          ? this.data[k]
          : null;
      },
      setItem(k, v) {
        this.data[k] = String(v);
        this.length = Object.keys(this.data).length;
      },
      removeItem(k) {
        delete this.data[k];
        this.length = Object.keys(this.data).length;
      },
      key(i) {
        return Object.keys(this.data)[i] || null;
      },
    };
  });

  it("versão local igual à remota → sem update", () => {
    expect(hasUpdate("abc", "abc")).toBe(false);
  });

  it("versão local diferente → update", () => {
    expect(hasUpdate("abc", "def")).toBe(true);
  });

  it("version.json URL usa cache busting", () => {
    const url = buildVersionUrl(true);
    expect(url).toMatch(/version\.json\?t=\d+/);
  });

  it("parseVersionPayload valida payload", () => {
    expect(parseVersionPayload({ version: "ee2775d" })).toEqual({
      version: "ee2775d",
      builtAt: null,
    });
    expect(parseVersionPayload({})).toBeNull();
  });

  it("fetchRemoteAppVersion sucesso", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json" },
      json: async () => ({ version: "v1", builtAt: "2026-08-03T00:00:00Z" }),
    });
    const remote = await fetchRemoteAppVersion(fetchImpl);
    expect(remote.version).toBe("v1");
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("version.json"),
      expect.objectContaining({ cache: "no-store" })
    );
  });

  it("falha temporária ao consultar versão", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network"));
    await expect(fetchRemoteAppVersion(fetchImpl)).rejects.toThrow("network");
  });

  it("retorno 404", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => "application/json" },
    });
    await expect(fetchRemoteAppVersion(fetchImpl)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("HTML (SPA fallback) tratado como ausência", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "text/html; charset=utf-8" },
      json: async () => ({}),
    });
    await expect(fetchRemoteAppVersion(fetchImpl)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("storage local/remota", () => {
    writeStoredAppVersion("a1", storage);
    expect(readStoredAppVersion(storage)).toBe("a1");
    expect(storage.data[APP_VERSION_STORAGE_KEY]).toBe("a1");
  });

  it("guard de reload impede loop", () => {
    expect(shouldBlockReloadLoop("x", session)).toBe(false);
    markReloadAttempt("x", session);
    markReloadAttempt("x", session);
    expect(shouldBlockReloadLoop("x", session)).toBe(true);
    clearReloadGuard(session);
    expect(shouldBlockReloadLoop("x", session)).toBe(false);
  });

  it("ChunkLoadError detection", () => {
    expect(isChunkLoadError({ name: "ChunkLoadError", message: "x" })).toBe(
      true
    );
    expect(
      isChunkLoadError({ message: "Loading chunk 5 failed." })
    ).toBe(true);
    expect(isChunkLoadError({ message: "random" })).toBe(false);
  });

  it("resolveLocalAppVersion prioriza meta do HTML", () => {
    const doc = {
      querySelector: () => ({ getAttribute: () => "from-meta" }),
    };
    writeStoredAppVersion("from-storage", storage);
    // eslint-disable-next-line global-require
    const { resolveLocalAppVersion } = require("../appVersion");
    expect(resolveLocalAppVersion(doc, storage)).toBe("from-meta");
  });

  it("isLikelyUnsavedWork é heurística de foco (não cobertura global)", () => {
    expect(
      isLikelyUnsavedWork({ activeElement: { tagName: "TEXTAREA" } })
    ).toBe(true);
    expect(
      isLikelyUnsavedWork({
        activeElement: {
          tagName: "INPUT",
          getAttribute: () => "text",
          closest: () => null,
        },
      })
    ).toBe(true);
    expect(
      isLikelyUnsavedWork({
        activeElement: {
          tagName: "INPUT",
          getAttribute: () => "checkbox",
          closest: () => null,
        },
      })
    ).toBe(false);
  });
});
