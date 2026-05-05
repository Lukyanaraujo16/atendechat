import { parseBrazilianCurrencyToNumber } from "../utils/normalizeMonetaryInput";

const BYTES_PER_GB = 1024 ** 3;

export function gbToBytes(gb: number): number {
  return Math.round(gb * BYTES_PER_GB);
}

function parseGbFromModel(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    return Number.isFinite(v) && v >= 0 ? v : null;
  }
  const n = parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Override da empresa, depois plano; null = sem limite (ilimitado).
 */
export function getCompanyStorageLimitBytes(
  company: { storageLimitGb?: unknown },
  plan?: { storageLimitGb?: unknown } | null
): number | null {
  const fromCompany = parseGbFromModel(company.storageLimitGb);
  if (fromCompany !== null) return gbToBytes(fromCompany);
  const fromPlan = plan ? parseGbFromModel(plan.storageLimitGb) : null;
  if (fromPlan !== null) return gbToBytes(fromPlan);
  return null;
}

export function formatBytesPtBr(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let u = 0;
  let n = bytes;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  /** B inteiro; KB com mais casas quando &lt; 10 KB; MB+ até 2 casas (ex.: 0,01 MB). */
  let maxFraction = 0;
  if (u === 0) maxFraction = 0;
  else if (u === 1) maxFraction = n < 10 ? 2 : 1;
  else maxFraction = 2;
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction
  })} ${units[u]}`;
}

export function computeStorageUsagePercent(
  usedBytes: number,
  limitBytes: number | null
): number | null {
  if (limitBytes === null || limitBytes <= 0) return null;
  return Math.round((usedBytes / limitBytes) * 1000) / 10;
}

export type StorageAlertLevel = "ok" | "attention" | "critical" | "exceeded";

/** Normal &lt; 80% · Atenção 80–89.9% · Crítico 90–99.9% · Excedido ≥ 100% */
export function resolveStorageAlertLevel(
  percent: number | null
): StorageAlertLevel {
  if (percent === null) return "ok";
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "critical";
  if (percent >= 80) return "attention";
  return "ok";
}

export function buildCompanyStorageEnrichmentPayload(
  row: Record<string, unknown>,
  plan?: { storageLimitGb?: unknown } | null
) {
  const used = Number(row.storageUsedBytes ?? 0);
  const limitBytes = getCompanyStorageLimitBytes(
    { storageLimitGb: row.storageLimitGb },
    plan || null
  );
  const percent = computeStorageUsagePercent(used, limitBytes);
  return {
    storageUsedBytes: used,
    storageLimitGb: row.storageLimitGb ?? null,
    effectiveStorageLimitBytes: limitBytes,
    storageUsagePercent: percent,
    storageCalculatedAt: row.storageCalculatedAt ?? null,
    storageAlertLevel: resolveStorageAlertLevel(percent),
    storageUsedFormatted: formatBytesPtBr(used),
    storageLimitFormatted:
      limitBytes !== null ? formatBytesPtBr(limitBytes) : null
  };
}
