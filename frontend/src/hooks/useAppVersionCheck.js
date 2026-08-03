import { useCallback, useEffect, useRef, useState } from "react";
import {
  APP_VERSION_CHANNEL,
  DEFAULT_VERSION_POLL_MS,
  clearReloadGuard,
  fetchRemoteAppVersion,
  hasUpdate,
  isLikelyUnsavedWork,
  markReloadAttempt,
  readStoredAppVersion,
  resolveLocalAppVersion,
  shouldBlockReloadLoop,
  writeStoredAppVersion,
} from "../utils/appVersion";

/**
 * Monitora version.json e expõe estado de atualização disponível.
 */
export default function useAppVersionCheck(options = {}) {
  const pollMs = options.pollMs ?? DEFAULT_VERSION_POLL_MS;
  const enabled = options.enabled !== false;
  const fetchImpl = options.fetchImpl;
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState(null);
  const [localVersion, setLocalVersion] = useState(null);
  const [lastError, setLastError] = useState(null);
  const checkingRef = useRef(false);
  const localRef = useRef(null);
  const mountedRef = useRef(true);
  const lastCheckAtRef = useRef(0);
  const debounceMs = options.debounceMs ?? 1500;

  const applyRemote = useCallback((remote) => {
    if (!remote?.version) return;
    const local =
      localRef.current ||
      resolveLocalAppVersion(document, window.localStorage);
    if (!local) {
      writeStoredAppVersion(remote.version);
      localRef.current = remote.version;
      setLocalVersion(remote.version);
      clearReloadGuard();
      setUpdateAvailable(false);
      setRemoteVersion(remote.version);
      return;
    }
    setLocalVersion(local);
    localRef.current = local;
    writeStoredAppVersion(local);
    setRemoteVersion(remote.version);
    if (hasUpdate(local, remote.version)) {
      setUpdateAvailable(true);
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel(APP_VERSION_CHANNEL);
          ch.postMessage({ type: "update_available", version: remote.version });
          ch.close();
        }
      } catch {
        // ignore
      }
    } else {
      setUpdateAvailable(false);
      writeStoredAppVersion(remote.version);
      localRef.current = remote.version;
      clearReloadGuard();
    }
  }, []);

  const check = useCallback(
    async (opts = {}) => {
      if (!enabled || checkingRef.current) return;
      const now = Date.now();
      if (!opts.force && now - lastCheckAtRef.current < debounceMs) {
        return;
      }
      checkingRef.current = true;
      lastCheckAtRef.current = now;
      try {
        const remote = await fetchRemoteAppVersion(fetchImpl || fetch);
        if (!mountedRef.current) return;
        setLastError(null);
        applyRemote(remote);
      } catch (err) {
        // Falha de rede/404/HTML inválido: sem modal falso
        if (mountedRef.current) {
          setLastError(err?.message || "version_check_failed");
        }
      } finally {
        checkingRef.current = false;
      }
    },
    [applyRemote, debounceMs, enabled, fetchImpl]
  );

  const reloadToUpdate = useCallback(() => {
    const target = remoteVersion || readStoredAppVersion() || "unknown";
    if (shouldBlockReloadLoop(target)) {
      setLastError("reload_loop_blocked");
      return false;
    }
    markReloadAttempt(target);
    const publicUrl = String(process.env.PUBLIC_URL || "").replace(/\/$/, "");
    const targetUrl = `${window.location.origin}${publicUrl}/?v=${encodeURIComponent(
      target
    )}`;
    window.location.replace(targetUrl);
    return true;
  }, [remoteVersion]);

  useEffect(() => {
    if (!enabled) return undefined;
    mountedRef.current = true;
    const stored = resolveLocalAppVersion(document, window.localStorage);
    localRef.current = stored;
    setLocalVersion(stored);
    if (stored) writeStoredAppVersion(stored);
    check({ force: true });

    const onFocus = () => check();
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(() => {
      check({ force: true });
    }, pollMs);

    let channel;
    try {
      if (typeof BroadcastChannel !== "undefined") {
        channel = new BroadcastChannel(APP_VERSION_CHANNEL);
        channel.onmessage = (ev) => {
          if (ev?.data?.type === "update_available" && ev.data.version) {
            setRemoteVersion(ev.data.version);
            setUpdateAvailable(true);
          }
        };
      }
    } catch {
      channel = null;
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
      try {
        if (channel) channel.close();
      } catch {
        // ignore
      }
    };
  }, [check, enabled, pollMs]);

  return {
    updateAvailable,
    remoteVersion,
    localVersion,
    lastError,
    check,
    reloadToUpdate,
    isLikelyUnsavedWork: () => isLikelyUnsavedWork(),
  };
}
