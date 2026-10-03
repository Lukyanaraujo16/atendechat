/** Espelha a regra do backend. Códigos são rótulos, sem conversão. */
export const KNOWN_PRODUCT_UNITS = [
  "un",
  "kg",
  "g",
  "L",
  "mL",
  "m",
  "cm",
  "cx",
  "pct",
];

export const PRODUCT_UNIT_OTHER = "__other__";
export const PRODUCT_UNIT_MAX_LENGTH = 16;

const NUMERIC_UNIT = /^\d+(?:[.,]\d+)?$/;
const SUSPICIOUS_UNIT = /^(?:un|kg|ml|cm|pct|cx|m|g|l)\d+$/i;

export function inspectProductUnit(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return { value: "", issue: "empty" };
  if (value.length > PRODUCT_UNIT_MAX_LENGTH) {
    return { value, issue: "too_long" };
  }
  if (NUMERIC_UNIT.test(value)) return { value, issue: "numeric" };
  if (KNOWN_PRODUCT_UNITS.includes(value)) return { value, issue: null };
  if (SUSPICIOUS_UNIT.test(value)) return { value, issue: "suspicious" };
  return { value, issue: null };
}

export function splitProductUnit(raw) {
  const value = raw == null ? "" : String(raw);
  const inspected = inspectProductUnit(value);
  if (!inspected.issue && KNOWN_PRODUCT_UNITS.includes(inspected.value)) {
    return { unitChoice: inspected.value, customUnit: "" };
  }
  return { unitChoice: PRODUCT_UNIT_OTHER, customUnit: value };
}

export function resolveProductUnit(unitChoice, customUnit) {
  if (unitChoice === PRODUCT_UNIT_OTHER) {
    return String(customUnit ?? "").trim();
  }
  return unitChoice;
}
