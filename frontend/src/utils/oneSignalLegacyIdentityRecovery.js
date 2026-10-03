/**
 * Recuperação seletiva, antes do SDK, de operações login-user legadas
 * que pausam o OperationRepo (HTTP 400 external_id blocked).
 *
 * Fail-closed: qualquer schema/App ID/erro incerto preserva o registro.
 * Não abre as stores identity, subscriptions nem pushSubscriptions.
 * A store identity do SDK v16 não tem appId — não é alterada.
 */

export const ONESIGNAL_SDK_DB_NAME = "ONE_SIGNAL_SDK_DB";
export const ONESIGNAL_SDK_DB_VERSION = 7;
export const ONESIGNAL_OPERATIONS_STORE = "operations";

const LOGIN_USER_OPERATION = "login-user";
const NUMERIC_EXTERNAL_ID = /^\d+$/;
const IDENTITY_SKIP_REASON = "identity_store_has_no_app_id";

function emptyResult(overrides = {}) {
  return {
    attempted: false,
    safeToProceed: true,
    removedLegacyLoginCount: 0,
    identityAdjusted: false,
    identityAdjustmentSkipped: IDENTITY_SKIP_REASON,
    reason: "not_started",
    ...overrides,
  };
}

function emit(log, event, detail) {
  if (typeof log === "function") {
    log(event, detail);
  }
}

function maskAppId(appId) {
  if (typeof appId !== "string" || appId.length < 8) return null;
  return `…${appId.slice(-4)}`;
}

function hasObjectStore(db, name) {
  const names = db && db.objectStoreNames;
  if (!names) return false;
  if (typeof names.contains === "function") return names.contains(name);
  if (Array.isArray(names)) return names.indexOf(name) !== -1;
  return false;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("indexeddb_request_failed"));
  });
}

/**
 * login-user completo do App ID atual, com External ID numérico ou vazio.
 * Registro incompleto, de outro app, ou com ID não numérico é preservado.
 */
export function isBlockingLegacyLoginUser(record, currentAppId) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return false;
  }
  if (record.name !== LOGIN_USER_OPERATION) return false;
  if (typeof currentAppId !== "string" || !currentAppId) return false;
  if (typeof record.appId !== "string" || record.appId !== currentAppId) {
    return false;
  }
  if (typeof record.modelId !== "string" || !record.modelId) return false;
  if (typeof record.onesignalId !== "string" || !record.onesignalId) {
    return false;
  }
  if (
    Object.prototype.hasOwnProperty.call(record, "modelName") &&
    record.modelName !== "operations"
  ) {
    return false;
  }

  if (!Object.prototype.hasOwnProperty.call(record, "externalId")) {
    return true;
  }
  const externalId = record.externalId;
  if (externalId == null || externalId === "") return true;
  if (typeof externalId !== "string") return false;
  if (externalId !== externalId.trim()) return false;
  return NUMERIC_EXTERNAL_ID.test(externalId);
}

async function withRecoveryLock(appId, task) {
  const locks = typeof navigator !== "undefined" ? navigator.locks : null;
  if (!locks || typeof locks.request !== "function") {
    return task();
  }
  let acquired = false;
  const outcome = await locks.request(
    `atendechat-onesignal-legacy-recovery:${appId}`,
    { ifAvailable: true },
    async (lock) => {
      if (!lock) return null;
      acquired = true;
      return task();
    }
  );
  if (!acquired) {
    return emptyResult({
      attempted: true,
      reason: "lock_unavailable",
    });
  }
  return outcome;
}

async function readOperations(db) {
  const tx = db.transaction(ONESIGNAL_OPERATIONS_STORE, "readonly");
  const store = tx.objectStore(ONESIGNAL_OPERATIONS_STORE);
  return requestToPromise(store.getAll());
}

async function deleteOperationIds(db, modelIds) {
  await new Promise((resolve, reject) => {
    let tx;
    try {
      tx = db.transaction(ONESIGNAL_OPERATIONS_STORE, "readwrite");
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(tx.error || new Error("indexeddb_transaction_failed"));
    tx.onabort = () =>
      reject(tx.error || new Error("indexeddb_transaction_aborted"));
    try {
      const store = tx.objectStore(ONESIGNAL_OPERATIONS_STORE);
      modelIds.forEach((modelId) => {
        store.delete(modelId);
      });
    } catch (error) {
      try {
        tx.abort();
      } catch (abortError) {
        /* a transação já pode ter abortado */
      }
      reject(error);
    }
  });
}

async function recoverInDatabase(appId, idb, log) {
  const detail = { appIdMasked: maskAppId(appId) };
  emit(log, "legacy_identity_recovery_started", detail);

  if (typeof idb.databases !== "function") {
    const result = emptyResult({
      attempted: true,
      reason: "databases_api_unavailable",
    });
    emit(log, "legacy_identity_recovery_skipped_unsafe_schema", {
      ...detail,
      reason: result.reason,
    });
    emit(log, "legacy_identity_recovery_finished", result);
    return result;
  }

  let databases;
  try {
    databases = await idb.databases();
  } catch (error) {
    const result = emptyResult({
      attempted: true,
      reason: "databases_lookup_failed",
    });
    emit(log, "legacy_identity_recovery_failed", {
      ...detail,
      reason: result.reason,
    });
    emit(log, "legacy_identity_recovery_finished", result);
    return result;
  }

  if (!Array.isArray(databases)) {
    const result = emptyResult({
      attempted: true,
      reason: "databases_lookup_unexpected",
    });
    emit(log, "legacy_identity_recovery_skipped_unsafe_schema", {
      ...detail,
      reason: result.reason,
    });
    emit(log, "legacy_identity_recovery_finished", result);
    return result;
  }

  const known = databases.some(
    (entry) => entry && entry.name === ONESIGNAL_SDK_DB_NAME
  );
  if (!known) {
    const result = emptyResult({
      attempted: true,
      reason: "database_absent",
    });
    emit(log, "legacy_identity_recovery_not_needed", {
      ...detail,
      reason: result.reason,
    });
    emit(log, "legacy_identity_recovery_finished", result);
    return result;
  }

  let db;
  try {
    db = await new Promise((resolve, reject) => {
      let upgraded = false;
      let request;
      try {
        request = idb.open(ONESIGNAL_SDK_DB_NAME);
      } catch (error) {
        reject(error);
        return;
      }
      request.onupgradeneeded = () => {
        upgraded = true;
        try {
          if (request.transaction) request.transaction.abort();
        } catch (abortError) {
          /* não criar schema */
        }
      };
      request.onerror = () =>
        reject(request.error || new Error("indexeddb_open_failed"));
      request.onsuccess = () => {
        if (upgraded) {
          try {
            request.result.close();
          } catch (closeError) {
            /* já fechado */
          }
          reject(new Error("unexpected_upgrade"));
          return;
        }
        resolve(request.result);
      };
    });
  } catch (error) {
    const unsafe = error && error.message === "unexpected_upgrade";
    const result = emptyResult({
      attempted: true,
      reason: unsafe ? "unexpected_upgrade" : "open_failed",
    });
    emit(
      log,
      unsafe
        ? "legacy_identity_recovery_skipped_unsafe_schema"
        : "legacy_identity_recovery_failed",
      { ...detail, reason: result.reason }
    );
    emit(log, "legacy_identity_recovery_finished", result);
    return result;
  }

  try {
    if (!db || db.version !== ONESIGNAL_SDK_DB_VERSION) {
      const result = emptyResult({
        attempted: true,
        reason: "unexpected_database_version",
      });
      emit(log, "legacy_identity_recovery_skipped_unsafe_schema", {
        ...detail,
        reason: result.reason,
      });
      emit(log, "legacy_identity_recovery_finished", result);
      return result;
    }
    if (!hasObjectStore(db, ONESIGNAL_OPERATIONS_STORE)) {
      const result = emptyResult({
        attempted: true,
        reason: "operations_store_missing",
      });
      emit(log, "legacy_identity_recovery_skipped_unsafe_schema", {
        ...detail,
        reason: result.reason,
      });
      emit(log, "legacy_identity_recovery_finished", result);
      return result;
    }

    let rows;
    try {
      rows = await readOperations(db);
    } catch (error) {
      const result = emptyResult({
        attempted: true,
        reason: "read_failed",
      });
      emit(log, "legacy_identity_recovery_failed", {
        ...detail,
        reason: result.reason,
      });
      emit(log, "legacy_identity_recovery_finished", result);
      return result;
    }

    if (!Array.isArray(rows)) {
      const result = emptyResult({
        attempted: true,
        reason: "operations_payload_unexpected",
      });
      emit(log, "legacy_identity_recovery_skipped_unsafe_schema", {
        ...detail,
        reason: result.reason,
      });
      emit(log, "legacy_identity_recovery_finished", result);
      return result;
    }

    const candidates = rows.filter((row) =>
      isBlockingLegacyLoginUser(row, appId)
    );
    if (candidates.length === 0) {
      const result = emptyResult({
        attempted: true,
        removedLegacyLoginCount: 0,
        reason: "no_blocking_login_user",
      });
      emit(log, "legacy_identity_recovery_not_needed", {
        ...detail,
        reason: result.reason,
      });
      emit(log, "legacy_identity_recovery_finished", result);
      return result;
    }

    emit(log, "legacy_identity_operations_found", {
      ...detail,
      count: candidates.length,
    });

    try {
      await deleteOperationIds(
        db,
        candidates.map((row) => row.modelId)
      );
    } catch (error) {
      const result = emptyResult({
        attempted: true,
        reason: "write_failed",
      });
      emit(log, "legacy_identity_recovery_failed", {
        ...detail,
        reason: result.reason,
      });
      emit(log, "legacy_identity_recovery_finished", result);
      return result;
    }

    const result = emptyResult({
      attempted: true,
      removedLegacyLoginCount: candidates.length,
      reason: "legacy_login_user_removed",
    });
    emit(log, "legacy_identity_operations_removed", {
      ...detail,
      count: candidates.length,
    });
    emit(log, "legacy_identity_recovery_finished", result);
    return result;
  } finally {
    try {
      db.close();
    } catch (closeError) {
      /* leitura já concluída */
    }
  }
}

/**
 * Executa antes de carregar o script do OneSignal.
 * @param {{ appId?: string, indexedDB?: IDBFactory, log?: Function }} options
 */
export async function recoverLegacyOneSignalIdentityBeforeInit(options = {}) {
  const appId = options.appId;
  const log = options.log;
  const idb =
    options.indexedDB ||
    (typeof indexedDB !== "undefined" ? indexedDB : null);

  if (typeof appId !== "string" || !appId) {
    const result = emptyResult({
      attempted: true,
      reason: "missing_app_id",
    });
    emit(log, "legacy_identity_recovery_skipped_unsafe_schema", {
      reason: result.reason,
    });
    emit(log, "legacy_identity_recovery_finished", result);
    return result;
  }

  if (!idb || typeof idb.open !== "function") {
    const result = emptyResult({
      attempted: true,
      reason: "indexeddb_unavailable",
    });
    emit(log, "legacy_identity_recovery_skipped_unsafe_schema", {
      appIdMasked: maskAppId(appId),
      reason: result.reason,
    });
    emit(log, "legacy_identity_recovery_finished", result);
    return result;
  }

  return withRecoveryLock(appId, () => recoverInDatabase(appId, idb, log));
}
