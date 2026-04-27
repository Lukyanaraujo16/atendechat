import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import { bootstrapPushAndPwaServiceWorker, syncOneSignalUser } from "../services/oneSignalService";

/**
 * Arranque global: regista OneSignal OU SW PWA mínimo; após login, associa utilizador e tags.
 */
export default function OneSignalIntegration() {
  const { user, isAuth } = useContext(AuthContext);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    bootstrapPushAndPwaServiceWorker().finally(() => setBooted(true));
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
