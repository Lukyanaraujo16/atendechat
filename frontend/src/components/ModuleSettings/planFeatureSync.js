import { getAllFeatureKeys } from "../../config/features";

/**
 * Diff entre dois mapas de features de plano (para diálogo ao gravar).
 * @returns {{ key: string, before: boolean, after: boolean }[]}
 */
export function diffPlanFeatureMaps(prev = {}, next = {}) {
  const keys = getAllFeatureKeys();
  const out = [];
  keys.forEach((k) => {
    const a = prev[k] === true;
    const b = next[k] === true;
    if (a !== b) {
      out.push({ key: k, before: a, after: b });
    }
  });
  return out;
}
