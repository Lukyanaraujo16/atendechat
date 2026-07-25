import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import { hasSerializedAgentOsConsoleAccess } from "../utils/agentOsConsoleAccess";
import {
  probeTechnicalConsoleAccess,
  resetTechnicalConsoleAccessCache,
} from "../services/technicalConsoleAccessProbe";

/**
 * Estados: loading | allowed | denied | error
 * Sessão serializada early-deny; probe backend confirma before allowed.
 */
export default function useTechnicalConsoleAccess() {
  const { user, loading: authLoading } = useContext(AuthContext);
  const [state, setState] = useState("loading");

  useEffect(() => {
    let cancelled = false;

    if (authLoading) {
      setState("loading");
      return undefined;
    }

    if (!user?.id) {
      resetTechnicalConsoleAccessCache();
      setState("denied");
      return undefined;
    }

    if (!hasSerializedAgentOsConsoleAccess(user)) {
      setState("denied");
      return undefined;
    }

    setState("loading");
    probeTechnicalConsoleAccess(user.id).then((outcome) => {
      if (cancelled) return;
      if (outcome.state === "allowed") setState("allowed");
      else if (outcome.state === "error") setState("error");
      else setState("denied");
    });

    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    user?.id,
    user?.isInternalUser,
    Array.isArray(user?.platformPermissions)
      ? user.platformPermissions.join("|")
      : "",
  ]);

  return state;
}
