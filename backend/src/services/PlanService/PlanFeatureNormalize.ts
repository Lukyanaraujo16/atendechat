import { getAllFeatureKeys } from "../../config/features";
import Plan from "../../models/Plan";
import {
  legacyPlanFeatureValue
} from "../../config/planFeatureLegacy";

function planFeaturesInputWithAliases(
  raw: unknown
): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const src = { ...(raw as Record<string, unknown>) };
  if (
    Object.prototype.hasOwnProperty.call(src, "contacts.crm") &&
    !Object.prototype.hasOwnProperty.call(src, "contacts.tags")
  ) {
    src["contacts.tags"] = src["contacts.crm"] === true;
  }
  return src;
}

/** Converte input da API (objeto parcial ou completo) em mapa completo de chaves.
 * Chaves omitidas usam o legado do plano (colunas + baseline), não `false` —
 * evita gravar PlanFeatures com false em massa por payload parcial.
 */
export function normalizePlanFeaturesInput(
  raw: unknown,
  plan?: Plan | Record<string, unknown> | null
): Record<string, boolean> {
  const keys = getAllFeatureKeys();
  const out: Record<string, boolean> = {};
  const src = planFeaturesInputWithAliases(raw);
  for (const k of keys) {
    if (src && Object.prototype.hasOwnProperty.call(src, k)) {
      out[k] = src[k] === true;
    } else {
      out[k] = legacyPlanFeatureValue(plan ?? null, k);
    }
  }
  return out;
}

export function planFeatureMapToEntries(
  map: Record<string, boolean>
): { featureKey: string; enabled: boolean }[] {
  return getAllFeatureKeys().map((featureKey) => ({
    featureKey,
    enabled: map[featureKey] === true
  }));
}
