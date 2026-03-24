/**
 * Garante que o valor seja sempre um array antes de usar .map, .forEach, etc.
 * (value || []) falha quando value é um objeto {}, pois {} é truthy.
 */
export const ensureArray = (value) =>
  Array.isArray(value) ? value : [];
