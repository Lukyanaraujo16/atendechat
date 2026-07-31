/**
 * Arranque global: OneSignal (script raiz, scope /push/onesignal/) + PWA/Workbox (scope /);
 * após login, associa utilizador e tags.
 */
import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import {
  bootstrapPushAndPwaServiceWorker,
  syncOneSignalUser,
  refreshOneSignalPushStatus,
  exposeOneSignalPushDiagnosticsGlobal,
} from "../services/oneSignalService";

export default function OneSignalIntegration() {
  const { user, isAuth } = useContext(AuthContext);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    exposeOneSignalPushDiagnosticsGlobal();
    bootstrapPushAndPwaServiceWorker()
      .then(() => {
        if (!cancelled) {
          refreshOneSignalPushStatus();
        }
      })
      .finally(() => {
        if (!cancelled) setBooted(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const queueKey = Array.isArray(user?.queues)
    ? user.queues.map((q) => q.id).join(",")
    : "";

  useEffect(() => {
    if (!booted || !isAuth || !user?.id) {
      return;
    }
    syncOneSignalUser(user);
  }, [booted, isAuth, user?.id, user?.companyId, user?.profile, queueKey]);

  return null;
}
