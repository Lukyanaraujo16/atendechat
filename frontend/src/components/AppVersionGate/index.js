import React, { useEffect, useState } from "react";
import AppUpdateModal from "../AppUpdateModal";
import useAppVersionCheck from "../../hooks/useAppVersionCheck";
import {
  isChunkLoadError,
  markReloadAttempt,
  shouldBlockReloadLoop,
} from "../../utils/appVersion";
import { bootstrapDisableWorkboxServiceWorker } from "../../utils/unregisterWorkboxServiceWorker";

/**
 * Orquestra: desliga Workbox, monitora version.json e trata ChunkLoadError.
 */
export default function AppVersionGate({ children }) {
  const {
    updateAvailable,
    reloadToUpdate,
    isLikelyUnsavedWork,
    remoteVersion,
  } = useAppVersionCheck();
  const [unsavedHint, setUnsavedHint] = useState(false);

  useEffect(() => {
    bootstrapDisableWorkboxServiceWorker();
  }, []);

  useEffect(() => {
    const onError = (event) => {
      const err = event?.error || event?.reason || event?.message;
      if (!isChunkLoadError(err)) return;
      const target = remoteVersion || "chunk";
      if (shouldBlockReloadLoop(target)) return;
      markReloadAttempt(target);
      // Uma tentativa controlada — evita loop
      window.location.reload();
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
    };
  }, [remoteVersion]);

  useEffect(() => {
    if (updateAvailable) {
      setUnsavedHint(isLikelyUnsavedWork());
    }
  }, [updateAvailable, isLikelyUnsavedWork]);

  return (
    <>
      {children}
      <AppUpdateModal
        open={updateAvailable}
        unsavedHint={unsavedHint}
        onUpdate={reloadToUpdate}
      />
    </>
  );
}
