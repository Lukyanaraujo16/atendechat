import AppError from "../../errors/AppError";

/** Códigos gravados como estão. Não há conversão entre unidades. */
export const KNOWN_INVENTORY_PRODUCT_UNITS = [
  "un",
  "kg",
  "g",
  "L",
  "mL",
  "m",
  "cm",
  "cx",
  "pct"
] as const;

export const INVENTORY_PRODUCT_UNIT_MAX_LENGTH = 16;

const NUMERIC_UNIT = /^\d+(?:[.,]\d+)?$/;
const SUSPICIOUS_UNIT = /^(?:un|kg|ml|cm|pct|cx|m|g|l)\d+$/i;

export type InventoryProductUnitIssue =
  | "empty"
  | "too_long"
  | "numeric"
  | "suspicious";

export function inspectInventoryProductUnit(raw: unknown): {
  value: string;
  issue: InventoryProductUnitIssue | null;
} {
  if (raw == null) {
    return { value: "", issue: "empty" };
  }
  const value = String(raw).trim();
  if (!value) {
    return { value: "", issue: "empty" };
  }
  if (value.length > INVENTORY_PRODUCT_UNIT_MAX_LENGTH) {
    return { value, issue: "too_long" };
  }
  if (NUMERIC_UNIT.test(value)) {
    return { value, issue: "numeric" };
  }
  if ((KNOWN_INVENTORY_PRODUCT_UNITS as readonly string[]).includes(value)) {
    return { value, issue: null };
  }
  if (SUSPICIOUS_UNIT.test(value)) {
    return { value, issue: "suspicious" };
  }
  return { value, issue: null };
}

function throwForUnitIssue(issue: InventoryProductUnitIssue): never {
  if (issue === "empty") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Informe a unidade de medida."
    );
  }
  if (issue === "too_long") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "A unidade de medida deve ter no máximo 16 caracteres."
    );
  }
  if (issue === "numeric") {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "A unidade de medida não pode ser apenas um número."
    );
  }
  throw new AppError(
    "ERR_VALIDATION_ERROR",
    400,
    "A unidade de medida parece misturar medida e quantidade."
  );
}

/** Valores novos: rejeita vazio, longo, numérico e padrão suspeito. */
export function assertNewInventoryProductUnit(raw: unknown): string {
  const inspected = inspectInventoryProductUnit(raw);
  if (inspected.issue) {
    throwForUnitIssue(inspected.issue);
  }
  return inspected.value;
}

/**
 * Update: se o texto não mudou, preserva o legado (un50, 60, 01).
 * Se mudou, aplica a regra dos valores novos.
 */
export function resolveInventoryProductUnitForUpdate(
  raw: unknown,
  currentUnit: string | null | undefined
): string {
  const inspected = inspectInventoryProductUnit(raw);
  const current = String(currentUnit ?? "").trim();
  if (inspected.value && inspected.value === current) {
    return inspected.value;
  }
  if (inspected.issue) {
    throwForUnitIssue(inspected.issue);
  }
  return inspected.value;
}
