/** Ordem estável dos grupos raiz (alinhado ao catálogo e à tabela). */
export const FEATURE_GROUP_ORDER = [
  "dashboard",
  "attendance",
  "automation",
  "agenda",
  "team",
  "finance",
  "campaigns",
  "contacts",
  "settings",
];

export function summarizePlanFeatures(planFeatures) {
  if (!planFeatures || typeof planFeatures !== "object") {
    return { count: 0, groups: [] };
  }
  const byRoot = {};
  let count = 0;
  Object.entries(planFeatures).forEach(([key, on]) => {
    if (on !== true) return;
    count += 1;
    const root = key.split(".")[0];
    byRoot[root] = true;
  });
  const groups = FEATURE_GROUP_ORDER.filter((g) => byRoot[g]);
  return { count, groups };
}
