import { useContext, useMemo } from "react";
import { AuthContext } from "../context/Auth/AuthContext";
import usePlanFlags from "./usePlanFlags";

/**
 * Feature granular do plano (ex.: "automation.openai").
 * Respeita effectiveFeatures da API + override false em modulePermissions da empresa.
 *
 * Enquanto `loaded`/`ready` for false, usa `user.effectiveUserFeatures` quando existir.
 *
 * @param {string} featureKey
 * @returns {{ enabled: boolean, loaded: boolean, ready: boolean }}
 */
export default function useFeature(featureKey) {
  const { user } = useContext(AuthContext);
  const { effectiveFeatures, loaded, ready } = usePlanFlags();
  const userFx = user?.effectiveUserFeatures;

  const enabled = useMemo(() => {
    if (effectiveFeatures[featureKey] === true) return true;
    if (!ready && userFx?.[featureKey] === true) return true;
    return false;
  }, [effectiveFeatures, featureKey, ready, userFx]);

  return { enabled, loaded, ready };
}
