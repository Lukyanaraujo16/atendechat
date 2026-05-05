import { formatBytesPtBr } from "./formatBytesPtBr";

/**
 * Aceita payload de GET /companies/storage ou enriquecimento de `show company`
 * (storageUsedBytes, storageUsedFormatted, etc.).
 */
export function normalizeCompanyStorageForCard(data) {
  if (data == null) return null;

  let usedBytes = Number(data.usedBytes ?? data.storageUsedBytes ?? 0);
  if (!Number.isFinite(usedBytes) || usedBytes < 0) {
    usedBytes = 0;
  }

  const limitBytesRaw =
    data.limitBytes != null
      ? Number(data.limitBytes)
      : data.effectiveStorageLimitBytes != null
        ? Number(data.effectiveStorageLimitBytes)
        : null;
  const limitBytes =
    limitBytesRaw != null && Number.isFinite(limitBytesRaw) ? limitBytesRaw : null;

  const usedFormatted =
    data.usedFormatted ??
    data.storageUsedFormatted ??
    formatBytesPtBr(usedBytes);

  let limitFormatted = data.limitFormatted ?? data.storageLimitFormatted ?? null;
  if (limitFormatted == null && limitBytes != null) {
    limitFormatted = formatBytesPtBr(limitBytes);
  }

  let remainingFormatted = data.remainingFormatted ?? null;
  if (remainingFormatted == null && limitBytes != null) {
    remainingFormatted = formatBytesPtBr(Math.max(0, limitBytes - usedBytes));
  }

  let percent = data.percent;
  if (percent == null && data.storageUsagePercent != null) {
    percent = data.storageUsagePercent;
  }
  if (percent == null && limitBytes != null && limitBytes > 0) {
    percent = Math.round((usedBytes / limitBytes) * 1000) / 10;
  }

  const calculatedAt = data.calculatedAt ?? data.storageCalculatedAt ?? null;

  return {
    usedFormatted,
    limitFormatted,
    remainingFormatted,
    percent: percent != null ? Number(percent) : null,
    calculatedAt,
  };
}
