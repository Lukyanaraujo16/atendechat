import { getAllFeatureKeys } from "../../config/features";

/** Converte input da API (objeto parcial ou completo) em mapa completo de chaves. */
export function normalizePlanFeaturesInput(
  raw: unknown
): Record<string, boolean> {
  const keys = getAllFeatureKeys();
  const out: Record<string, boolean> = {};
  const src =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : undefined;
  for (const k of keys) {
    out[k] = src ? src[k] === true : false;
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
