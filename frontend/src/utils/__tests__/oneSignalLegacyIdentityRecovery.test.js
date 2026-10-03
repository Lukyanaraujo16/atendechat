import fs from "fs";
import path from "path";
import { isRemoteOneSignalIdentityConfirmed } from "../oneSignalIdentity";
import {
  isBlockingLegacyLoginUser,
  recoverLegacyOneSignalIdentityBeforeInit,
} from "../oneSignalLegacyIdentityRecovery";

function later(fn) {
  Promise.resolve().then(fn);
}

const APP = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const REMOTE_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TOKEN = "secret-push-token-must-stay";

function loginUser(overrides = {}) {
  return {
    modelId: "op-login",
    modelName: "operations",
    name: "login-user",
    appId: APP,
    onesignalId: "local-56812b9b-0eaa-4494-b9aa-1abe1e3ab82e",
    existingOnesignalId: null,
    externalId: "25",
    ...overrides,
  };
}

function createMemoryIdb({
  operations = [],
  subscriptions = [],
  identity = [],
  version = 7,
  present = true,
  failRead = false,
  failWriteOn = null,
  upgrade = false,
  missingOperations = false,
  databasesImpl,
} = {}) {
  const stores = {
    operations: operations.map((row) => ({ ...row })),
    subscriptions: subscriptions.map((row) => ({ ...row })),
    identity: identity.map((row) => ({ ...row })),
  };
  const openedStores = [];
  let openCalls = 0;

  return {
    stores,
    openedStores,
    get openCalls() {
      return openCalls;
    },
    databases:
      databasesImpl ||
      (async () =>
        present ? [{ name: "ONE_SIGNAL_SDK_DB", version }] : []),
    open() {
      openCalls += 1;
      const request = {};
      later(() => {
        if (upgrade) {
          request.transaction = { abort() {} };
          request.result = { close() {}, version };
          if (request.onupgradeneeded) request.onupgradeneeded();
          if (request.onsuccess) request.onsuccess();
          return;
        }
        const names = missingOperations
          ? ["subscriptions", "identity"]
          : ["operations", "subscriptions", "identity"];
        request.result = {
          version,
          objectStoreNames: {
            contains(storeName) {
              return names.indexOf(storeName) !== -1;
            },
          },
          close() {},
          transaction(storeName, mode) {
            openedStores.push({ storeName, mode });
            if (storeName !== "operations") {
              throw new Error(`store inesperada: ${storeName}`);
            }
            const snapshot = stores.operations.map((row) => ({ ...row }));
            let aborted = false;
            const tx = {
              error: null,
              abort() {
                aborted = true;
                stores.operations = snapshot.map((row) => ({ ...row }));
              },
              objectStore() {
                return {
                  getAll() {
                    const req = {};
                    later(() => {
                      if (failRead) {
                        req.error = new Error("read_failed");
                        if (req.onerror) req.onerror();
                        return;
                      }
                      req.result = stores.operations.map((row) => ({ ...row }));
                      if (req.onsuccess) req.onsuccess();
                    });
                    return req;
                  },
                  delete(key) {
                    const req = {};
                    if (failWriteOn != null && key === failWriteOn) {
                      aborted = true;
                      stores.operations = snapshot.map((row) => ({ ...row }));
                      tx.error = new Error("write_failed");
                      later(() => {
                        if (req.onerror) req.onerror();
                        if (tx.onabort) tx.onabort();
                      });
                      return req;
                    }
                    stores.operations = stores.operations.filter(
                      (row) => row.modelId !== key
                    );
                    later(() => {
                      if (req.onsuccess) req.onsuccess();
                    });
                    return req;
                  },
                };
              },
            };
            later(() => {
              if (!aborted && tx.oncomplete) tx.oncomplete();
            });
            return tx;
          },
        };
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    },
  };
}

function baseOptions(idb, log) {
  return { appId: APP, indexedDB: idb, log };
}

describe("oneSignalLegacyIdentityRecovery", () => {
  const originalLocks = navigator.locks;

  afterEach(() => {
    if (originalLocks) {
      navigator.locks = originalLocks;
    } else {
      delete navigator.locks;
    }
  });

  it("browser sem IndexedDB relevante não altera nada", async () => {
    const idb = createMemoryIdb({ present: false, operations: [loginUser()] });
    const result = await recoverLegacyOneSignalIdentityBeforeInit(
      baseOptions(idb)
    );
    expect(result.reason).toBe("database_absent");
    expect(result.removedLegacyLoginCount).toBe(0);
    expect(result.safeToProceed).toBe(true);
    expect(idb.openCalls).toBe(0);
    expect(idb.stores.operations).toHaveLength(1);
  });

  it("App ID vazio não abre o banco", async () => {
    const idb = createMemoryIdb({ operations: [loginUser()] });
    const result = await recoverLegacyOneSignalIdentityBeforeInit({
      appId: "",
      indexedDB: idb,
    });
    expect(result.reason).toBe("missing_app_id");
    expect(idb.openCalls).toBe(0);
    expect(idb.stores.operations[0].externalId).toBe("25");
  });

  it("store ausente ou versão inesperada é fail-closed", async () => {
    const missing = createMemoryIdb({
      missingOperations: true,
      operations: [loginUser()],
    });
    const missingResult = await recoverLegacyOneSignalIdentityBeforeInit(
      baseOptions(missing)
    );
    expect(missingResult.reason).toBe("operations_store_missing");
    expect(missing.openedStores).toEqual([]);

    const old = createMemoryIdb({
      version: 6,
      operations: [loginUser()],
    });
    const oldResult = await recoverLegacyOneSignalIdentityBeforeInit(
      baseOptions(old)
    );
    expect(oldResult.reason).toBe("unexpected_database_version");
    expect(old.openedStores).toEqual([]);
    expect(old.stores.operations).toHaveLength(1);
  });

  it("preserva login-user de outro App ID", async () => {
    const foreign = loginUser({
      modelId: "foreign",
      appId: OTHER,
      externalId: "25",
    });
    const idb = createMemoryIdb({ operations: [foreign] });
    const result = await recoverLegacyOneSignalIdentityBeforeInit(
      baseOptions(idb)
    );
    expect(result.removedLegacyLoginCount).toBe(0);
    expect(idb.stores.operations).toEqual([foreign]);
  });

  it("remove login-user numérico do App ID atual, inclusive vários IDs", async () => {
    const keep = loginUser({
      modelId: "keep",
      externalId: "streamhub_user_25",
    });
    const idb = createMemoryIdb({
      operations: [
        loginUser({ modelId: "a", externalId: "25" }),
        loginUser({ modelId: "b", externalId: "1" }),
        loginUser({ modelId: "c", externalId: "32" }),
        keep,
      ],
    });
    const result = await recoverLegacyOneSignalIdentityBeforeInit(
      baseOptions(idb)
    );
    expect(result.removedLegacyLoginCount).toBe(3);
    expect(result.reason).toBe("legacy_login_user_removed");
    expect(idb.stores.operations).toEqual([keep]);
  });

  it("preserva External ID namespaced e não numérico desconhecido", async () => {
    const rows = [
      loginUser({ modelId: "ns", externalId: "streamhub_user_32" }),
      loginUser({ modelId: "other", externalId: "custom-user" }),
      loginUser({ modelId: "pad", externalId: " 25 " }),
    ];
    const idb = createMemoryIdb({ operations: rows });
    const result = await recoverLegacyOneSignalIdentityBeforeInit(
      baseOptions(idb)
    );
    expect(result.removedLegacyLoginCount).toBe(0);
    expect(idb.stores.operations.map((row) => row.modelId)).toEqual([
      "ns",
      "other",
      "pad",
    ]);
  });

  it("preserva update, create e transfer subscription", async () => {
    const rows = ["update-subscription", "create-subscription", "transfer-subscription"].map(
      (name, index) => ({
        modelId: `sub-op-${index}`,
        modelName: "operations",
        name,
        appId: APP,
        onesignalId: "local-56812b9b-0eaa-4494-b9aa-1abe1e3ab82e",
        externalId: "25",
        token: TOKEN,
      })
    );
    const idb = createMemoryIdb({ operations: rows });
    await recoverLegacyOneSignalIdentityBeforeInit(baseOptions(idb));
    expect(idb.stores.operations).toEqual(rows);
  });

  it("não escreve subscriptions nem identity e preserva token", async () => {
    const subscription = { modelId: "sub-1", token: TOKEN };
    const identity = {
      modelId: "identity-1",
      external_id: "streamhub_user_25",
      onesignal_id: `local-${REMOTE_ID}`,
    };
    const idb = createMemoryIdb({
      operations: [loginUser()],
      subscriptions: [subscription],
      identity: [identity],
    });
    const logs = [];
    const result = await recoverLegacyOneSignalIdentityBeforeInit(
      baseOptions(idb, (event, detail) => logs.push({ event, detail }))
    );
    expect(result.removedLegacyLoginCount).toBe(1);
    expect(result.identityAdjusted).toBe(false);
    expect(result.identityAdjustmentSkipped).toBe("identity_store_has_no_app_id");
    expect(idb.stores.subscriptions).toEqual([subscription]);
    expect(idb.stores.identity).toEqual([identity]);
    expect(idb.openedStores.every((entry) => entry.storeName === "operations")).toBe(
      true
    );
    expect(JSON.stringify(logs)).not.toContain(TOKEN);
  });

  it("segunda execução é idempotente", async () => {
    const idb = createMemoryIdb({
      operations: [loginUser(), loginUser({ modelId: "keep", externalId: "streamhub_user_25" })],
    });
    const first = await recoverLegacyOneSignalIdentityBeforeInit(baseOptions(idb));
    const second = await recoverLegacyOneSignalIdentityBeforeInit(baseOptions(idb));
    expect(first.removedLegacyLoginCount).toBe(1);
    expect(second.removedLegacyLoginCount).toBe(0);
    expect(second.reason).toBe("no_blocking_login_user");
    expect(idb.stores.operations).toHaveLength(1);
  });

  it("erro de leitura não apaga", async () => {
    const idb = createMemoryIdb({
      failRead: true,
      operations: [loginUser()],
    });
    const result = await recoverLegacyOneSignalIdentityBeforeInit(baseOptions(idb));
    expect(result.reason).toBe("read_failed");
    expect(result.safeToProceed).toBe(true);
    expect(idb.stores.operations).toHaveLength(1);
  });

  it("erro de escrita reverte e não amplia a limpeza", async () => {
    const idb = createMemoryIdb({
      failWriteOn: "b",
      operations: [
        loginUser({ modelId: "a", externalId: "25" }),
        loginUser({ modelId: "b", externalId: "1" }),
        loginUser({ modelId: "keep", externalId: "streamhub_user_25" }),
      ],
    });
    const result = await recoverLegacyOneSignalIdentityBeforeInit(baseOptions(idb));
    expect(result.reason).toBe("write_failed");
    expect(result.removedLegacyLoginCount).toBe(0);
    expect(idb.stores.operations.map((row) => row.modelId)).toEqual([
      "a",
      "b",
      "keep",
    ]);
  });

  it("identidade remota e identidade local sem App ID permanecem intactas", async () => {
    const remote = {
      modelId: "id-remote",
      external_id: "25",
      onesignal_id: REMOTE_ID,
    };
    const local = {
      modelId: "id-local",
      external_id: "streamhub_user_25",
      onesignal_id: "local-56812b9b-0eaa-4494-b9aa-1abe1e3ab82e",
    };
    const idb = createMemoryIdb({
      operations: [loginUser()],
      identity: [remote, local],
    });
    const result = await recoverLegacyOneSignalIdentityBeforeInit(baseOptions(idb));
    expect(result.identityAdjusted).toBe(false);
    expect(idb.stores.identity).toEqual([remote, local]);
  });

  it("registro incompleto não é candidato", () => {
    expect(
      isBlockingLegacyLoginUser(
        { name: "login-user", appId: APP, externalId: "25" },
        APP
      )
    ).toBe(false);
    expect(
      isBlockingLegacyLoginUser(
        loginUser({ externalId: undefined, modelId: "" }),
        APP
      )
    ).toBe(false);
  });

  it("login-user completo sem externalId do App ID atual é candidato", () => {
    const row = loginUser();
    delete row.externalId;
    expect(isBlockingLegacyLoginUser(row, APP)).toBe(true);
    expect(isBlockingLegacyLoginUser(loginUser({ externalId: "" }), APP)).toBe(
      true
    );
    expect(isBlockingLegacyLoginUser(loginUser({ externalId: null }), APP)).toBe(
      true
    );
  });

  it("lock indisponível não apaga", async () => {
    navigator.locks = {
      request: jest.fn(async (_name, _options, callback) => callback(null)),
    };
    const idb = createMemoryIdb({ operations: [loginUser()] });
    const result = await recoverLegacyOneSignalIdentityBeforeInit(baseOptions(idb));
    expect(result.reason).toBe("lock_unavailable");
    expect(idb.openCalls).toBe(0);
    expect(idb.stores.operations).toHaveLength(1);
  });

  it("a recovery roda antes de carregar o script do SDK", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../../services/oneSignalService.js"),
      "utf8"
    );
    const initAt = source.indexOf("initPromise = (async () => {");
    const recoveryAt = source.indexOf(
      "recoverLegacyOneSignalIdentityBeforeInit",
      initAt
    );
    const loadAt = source.indexOf("await loadOneSignalPageScript()", recoveryAt);
    expect(initAt).toBeGreaterThan(-1);
    expect(recoveryAt).toBeGreaterThan(initAt);
    expect(loadAt).toBeGreaterThan(recoveryAt);
  });
});

describe("confirmação remota da identidade", () => {
  const expected = "streamhub_user_25";

  it("promise implícita com onesignalId nulo não confirma", () => {
    expect(
      isRemoteOneSignalIdentityConfirmed(
        { externalId: expected, onesignalId: null },
        expected
      )
    ).toBe(false);
    expect(
      isRemoteOneSignalIdentityConfirmed(
        { externalId: expected, onesignalId: undefined },
        expected
      )
    ).toBe(false);
  });

  it("onesignalId local não confirma", () => {
    expect(
      isRemoteOneSignalIdentityConfirmed(
        { externalId: expected, onesignalId: "local-56812b9b-0eaa-4494-b9aa-1abe1e3ab82e" },
        expected
      )
    ).toBe(false);
  });

  it("externalId diferente não confirma", () => {
    expect(
      isRemoteOneSignalIdentityConfirmed(
        { externalId: "25", onesignalId: REMOTE_ID },
        expected
      )
    ).toBe(false);
  });

  it("externalId esperado e OneSignal ID remoto confirma", () => {
    expect(
      isRemoteOneSignalIdentityConfirmed(
        { externalId: expected, onesignalId: REMOTE_ID },
        expected
      )
    ).toBe(true);
  });
});
