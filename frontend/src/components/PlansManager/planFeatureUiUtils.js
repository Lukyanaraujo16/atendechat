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
  "crm",
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
  const knownOrdered = FEATURE_GROUP_ORDER.filter((g) => byRoot[g]);
  const extra = Object.keys(byRoot)
    .filter((g) => !FEATURE_GROUP_ORDER.includes(g))
    .sort();
  return { count, groups: [...knownOrdered, ...extra] };
}

/**
 * Raízes do catálogo FEATURES na ordem de UI + grupos presentes só no catálogo (fim),
 * para não ocultar novos grupos se FEATURE_GROUP_ORDER faltar uma entrada.
 */
export function getOrderedPlanFeatureRootKeys(featuresCatalog) {
  const catalog = featuresCatalog && typeof featuresCatalog === "object" ? featuresCatalog : {};
  const known = FEATURE_GROUP_ORDER.filter((k) => catalog[k]);
  const extra = Object.keys(catalog)
    .filter((k) => catalog[k] && !FEATURE_GROUP_ORDER.includes(k))
    .sort();
  return [...known, ...extra];
}
