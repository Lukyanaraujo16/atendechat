import usePlanFlags from "./usePlanFlags";

/**
 * Feature granular do plano (ex.: "automation.openai").
 * Respeita effectiveFeatures da API + override false em modulePermissions da empresa.
 *
 * @param {string} featureKey
 * @returns {{ enabled: boolean, loaded: boolean }}
 */
export default function useFeature(featureKey) {
  const { effectiveFeatures, loaded } = usePlanFlags();
  const enabled = loaded ? effectiveFeatures[featureKey] === true : false;
  return { enabled, loaded };
}
