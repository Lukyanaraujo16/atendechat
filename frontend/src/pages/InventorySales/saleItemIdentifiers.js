export const IDENTIFIER_MAX_LEN = 255;
export const INLINE_IDENTIFIER_SLOT_MAX = 8;

export function isWholeQuantity(quantity) {
  const n = Number(quantity);
  if (!Number.isFinite(n) || n <= 0) return false;
  return Math.abs(n - Math.round(n)) < 1e-6;
}

export function wholeQuantityValue(quantity) {
  if (!isWholeQuantity(quantity)) return 0;
  return Math.round(Number(quantity));
}

export function identifiersFromSaleItem(item) {
  const list = Array.isArray(item?.identifiers) ? item.identifiers : [];
  return list
    .map((row) => ({
      id: row?.id,
      position: Number(row?.position),
      identifier: row?.identifier == null ? "" : String(row.identifier),
    }))
    .filter(
      (row) => Number.isInteger(row.position) && row.position >= 1 && row.identifier.trim()
    )
    .sort((a, b) => a.position - b.position);
}

export function identifierValuesFromItem(item) {
  const values = {};
  identifiersFromSaleItem(item).forEach((row) => {
    values[row.position] = row.identifier;
  });
  return values;
}

export function filledIdentifierPositions(values) {
  return Object.keys(values || {})
    .map(Number)
    .filter(
      (position) =>
        Number.isInteger(position) &&
        position >= 1 &&
        String(values[position] || "").trim()
    )
    .sort((a, b) => a - b);
}

export function hasFilledIdentifiers(values) {
  return filledIdentifierPositions(values).length > 0;
}

export function toPayloadIdentifiers(values) {
  return filledIdentifierPositions(values).map((position) => ({
    position,
    identifier: String(values[position]).trim(),
  }));
}

export function identifierPayloadsEqual(left, right) {
  const a = Array.isArray(left) ? left : toPayloadIdentifiers(left);
  const b = Array.isArray(right) ? right : toPayloadIdentifiers(right);
  if (a.length !== b.length) return false;
  return a.every(
    (row, index) =>
      row.position === b[index].position && row.identifier === b[index].identifier
  );
}

export function findDuplicateIdentifier(values) {
  const seen = new Map();
  for (const position of filledIdentifierPositions(values)) {
    const identifier = String(values[position]).trim();
    if (seen.has(identifier)) {
      return { identifier, positions: [seen.get(identifier), position] };
    }
    seen.set(identifier, position);
  }
  return null;
}

export function findExceedingFilledPositions(values, newQuantity) {
  const filled = filledIdentifierPositions(values);
  if (!filled.length) return [];
  if (!isWholeQuantity(newQuantity)) {
    return filled;
  }
  const maxPosition = Math.round(Number(newQuantity));
  return filled.filter((position) => position > maxPosition);
}

export function nextAvailablePosition(quantity, occupiedPositions) {
  const maxPosition = wholeQuantityValue(quantity);
  const used = new Set((occupiedPositions || []).map(Number));
  for (let position = 1; position <= maxPosition; position += 1) {
    if (!used.has(position)) return position;
  }
  return null;
}

export function usesInlineIdentifierSlots(quantity) {
  const qty = wholeQuantityValue(quantity);
  return qty > 0 && qty <= INLINE_IDENTIFIER_SLOT_MAX;
}

export function isFractionalIdentifierResolution(quantity, values) {
  const n = Number(quantity);
  return (
    Number.isFinite(n) &&
    n > 0 &&
    !isWholeQuantity(quantity) &&
    hasFilledIdentifiers(values)
  );
}

export function visibleIdentifierPositions({
  quantity,
  values,
  extraPositions = [],
}) {
  const filled = filledIdentifierPositions(values);
  if (isFractionalIdentifierResolution(quantity, values)) {
    return filled;
  }

  const qty = wholeQuantityValue(quantity);
  const overflowing = filled.filter((position) => position > qty);

  if (qty <= 0) {
    return overflowing;
  }

  if (usesInlineIdentifierSlots(quantity)) {
    const slots = [];
    for (let position = 1; position <= qty; position += 1) {
      slots.push(position);
    }
    overflowing.forEach((position) => {
      if (!slots.includes(position)) slots.push(position);
    });
    return slots.sort((a, b) => a - b);
  }

  const extras = (extraPositions || []).filter(
    (position) =>
      Number.isInteger(Number(position)) &&
      Number(position) >= 1 &&
      Number(position) <= qty &&
      !filled.includes(Number(position))
  );
  return [...new Set([...filled, ...extras, ...overflowing])]
    .map(Number)
    .sort((a, b) => a - b);
}

export function validateIdentifiersForSubmit({ quantity, values }) {
  const exceeding = findExceedingFilledPositions(values, quantity);
  if (exceeding.length) {
    if (!isWholeQuantity(quantity)) {
      return { ok: false, code: "fractionalNeedsClear" };
    }
    return { ok: false, code: "reduceQuantity", position: exceeding[0] };
  }

  const duplicate = findDuplicateIdentifier(values);
  if (duplicate) {
    return { ok: false, code: "duplicate" };
  }

  for (const position of filledIdentifierPositions(values)) {
    if (String(values[position]).trim().length > IDENTIFIER_MAX_LEN) {
      return { ok: false, code: "maxLength" };
    }
  }

  return { ok: true };
}

/**
 * CREATE: só envia identifiers se houver valores preenchidos.
 * Omitir (não enviar []) evita persistir lista vazia sem necessidade.
 */
export function buildCreateIdentifiersField({ quantity, values }) {
  if (!isWholeQuantity(quantity)) {
    return { include: false };
  }
  const identifiers = toPayloadIdentifiers(values);
  if (!identifiers.length) {
    return { include: false };
  }
  return { include: true, identifiers };
}

/**
 * UPDATE:
 * - identifiers omitido → backend não altera
 * - identifiers: [] → backend apaga
 * Só inclui o campo se o usuário mexeu nos identificadores.
 */
export function buildUpdateIdentifiersField({
  identifiersTouched,
  quantity,
  values,
  originalValues,
}) {
  if (!identifiersTouched) {
    return { include: false };
  }
  if (identifierPayloadsEqual(values, originalValues)) {
    return { include: false };
  }
  const identifiers = toPayloadIdentifiers(values);
  if (!isWholeQuantity(quantity)) {
    if (identifiers.length === 0) {
      return { include: true, identifiers: [] };
    }
    return { include: false };
  }
  return { include: true, identifiers };
}

export function emptyIdentifierDraft() {
  return {
    identifierValues: {},
    extraPositions: [],
    identifiersTouched: false,
  };
}

export function identifierDraftFromItem(item) {
  return {
    identifierValues: identifierValuesFromItem(item),
    extraPositions: [],
    identifiersTouched: false,
  };
}
