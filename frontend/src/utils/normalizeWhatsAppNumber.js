/** Remove tudo que não for dígito (aceita colar +55 (27) 99999-9999). */
export function normalizeWhatsAppInput(value) {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * Sugere código do país quando o número parece local (ex.: BR sem 55).
 * Não altera o valor — só orienta o usuário.
 */
export function suggestWhatsAppCountryCode(digits, defaultCode = "55") {
  const d = normalizeWhatsAppInput(digits);
  if (!d || d.length >= 12) return null;
  if (d.startsWith(defaultCode)) return null;
  if (d.length >= 10 && d.length <= 11) return defaultCode;
  return null;
}
