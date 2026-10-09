/** Máscaras visuais do Cliente comercial (PDV). Persistência = só dígitos. */

export function onlyDigits(value, maxLen) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (maxLen != null) return digits.slice(0, maxLen);
  return digits;
}

/** Celular (11): (27) 99999-9999 · Fixo (10): (27) 3333-4444 */
export function formatInventoryCustomerPhone(value) {
  const d = onlyDigits(value, 11);
  if (!d) return "";
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
}

/**
 * CPF enquanto ≤11 dígitos; CNPJ a partir do 12º até 14.
 * 12900985730 → 129.009.857-30
 * 00000000000191 → 00.000.000/0001-91
 */
export function formatInventoryCustomerDocument(value) {
  const d = onlyDigits(value, 14);
  if (!d) return "";
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) {
      return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    }
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  // CNPJ
  if (d.length <= 12) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  }
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(
    8,
    12
  )}-${d.slice(12, 14)}`;
}

export function digitsForPersist(value) {
  const d = onlyDigits(value);
  return d.length ? d : null;
}
