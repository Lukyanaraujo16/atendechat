/**
 * Converte o campo `super` do body (boolean, número, string) sem usar Boolean(string),
 * pois Boolean("false") === true.
 */
export function parseSuperFlagBody(body: { super?: unknown }): boolean {
  const v = body.super;
  if (v === undefined || v === null) {
    return true;
  }
  if (v === true || v === 1) {
    return true;
  }
  if (v === false || v === 0) {
    return false;
  }
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") {
      return true;
    }
    if (s === "false" || s === "0" || s === "") {
      return false;
    }
  }
  return Boolean(v);
}

/** Valor explícito de `super` no PATCH; se omitido no body, devolve undefined. */
export function parseOptionalSuperFlag(
  userData: { super?: unknown }
): boolean | undefined {
  if (!Object.prototype.hasOwnProperty.call(userData, "super")) {
    return undefined;
  }
  const v = userData.super;
  if (v === null) {
    return undefined;
  }
  return parseSuperFlagBody({ super: v });
}
