/**
 * Arranque global: OneSignal (script raiz, scope /push/onesignal/) + PWA/Workbox (scope /);
 * após login, associa utilizador e tags (single-flight no serviço).
 */
import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import {
  bootstrapPushAndPwaServiceWorker,
  syncOneSignalUser,
  refreshOneSignalPushStatus,
  exposeOneSignalPushDiagnosticsGlobal,
} from "../services/oneSignalService";
import { oneSignalTagsSignature, buildOneSignalIdentityTags, resolveOneSignalExternalId } from "../utils/oneSignalIdentity";

export default function OneSignalIntegration() {
  const { user, isAuth } = useContext(AuthContext);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    exposeOneSignalPushDiagnosticsGlobal(user);
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
    // Bootstrap uma vez; user para diagnóstico é atualizado noutro efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    exposeOneSignalPushDiagnosticsGlobal(user);
  }, [user?.id, user?.super, user?.supportMode]);

  const externalId = resolveOneSignalExternalId(user);
  const tagsKey = user
    ? oneSignalTagsSignature(buildOneSignalIdentityTags(user, externalId || ""))
    : "";

  useEffect(() => {
    if (!booted || !isAuth || !externalId) {
      return;
    }
    let cancelled = false;
    (async () => {
      // Retry limitado fica no serviço; não chama login a cada render.
      await syncOneSignalUser(user);
      if (cancelled) return;
    })();
    // Dedup real ocorre no serviço (single-flight + cache de tags).
    // Dispara só quando identidade ou tags relevantes mudam — não a cada render.
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, isAuth, externalId, tagsKey]);

  return null;
}
