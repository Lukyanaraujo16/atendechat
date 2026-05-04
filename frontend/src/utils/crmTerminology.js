import { i18n } from "../translate/i18n";

const ALLOWED = new Set([
  "general",
  "support",
  "clinic",
  "aesthetic_clinic",
  "real_estate",
  "gym",
  "school",
  "ecommerce",
  "automotive",
  "financial",
  "legal",
  "healthcare",
  "service",
  "other",
]);

/** Alinha com backend/src/config/businessSegment.ts */
export function normalizeCrmSegment(raw) {
  const v = String(raw || "").trim();
  if (!v || !ALLOWED.has(v)) return "general";
  if (v === "other") return "general";
  return v;
}

function tTerm(segment, key) {
  const s = normalizeCrmSegment(segment);
  const path = `crm.terminology.${s}.${key}`;
  const out = i18n.t(path);
  if (out === path) {
    return i18n.t(`crm.terminology.general.${key}`);
  }
  return out;
}

export function getCrmTerminology(segment) {
  return {
    boardTitle: tTerm(segment, "boardTitle"),
    createButton: tTerm(segment, "createButton"),
    itemSingular: tTerm(segment, "itemSingular"),
    itemPlural: tTerm(segment, "itemPlural"),
    statusWon: tTerm(segment, "statusWon"),
    statusLost: tTerm(segment, "statusLost"),
    metricOpen: tTerm(segment, "metricOpen"),
    metricWon: tTerm(segment, "metricWon"),
    metricLost: tTerm(segment, "metricLost"),
    metricValueOpen: tTerm(segment, "metricValueOpen"),
  };
}
