/**
 * Digitação percentual direta (pt-BR). Nunca máscara monetária/centavos.
 * Compartilhado entre desconto de item e desconto global.
 */

export function parsePercentInput(value) {
  if (value === "" || value == null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const raw = String(value).trim().replace("%", "").replace(/\s/g, "");
  if (!raw || raw === "," || raw === ".") return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/**
 * Mantém digitação livre: dígitos + no máx. um separador decimal (, ou .).
 * Não desloca casas, não força zeros.
 */
export function sanitizePercentTyping(raw) {
  if (raw == null) return "";
  let text = String(raw).replace("%", "").replace(/\s/g, "");
  text = text.replace(/[^\d.,]/g, "");
  const comma = text.indexOf(",");
  const dot = text.indexOf(".");
  let sep = -1;
  if (comma >= 0 && dot >= 0) {
    sep = Math.min(comma, dot);
  } else {
    sep = Math.max(comma, dot);
  }
  if (sep >= 0) {
    const head = text.slice(0, sep).replace(/[^\d]/g, "");
    const sepChar = text[sep];
    const tail = text.slice(sep + 1).replace(/[^\d]/g, "");
    text = `${head}${sepChar}${tail}`;
  } else {
    text = text.replace(/[^\d]/g, "");
  }
  return text;
}

/** Draft persistido → string de input sem "0.00" / zeros artificiais. */
export function formatPercentDraftValue(value) {
  if (value === "" || value == null) return "";
  const n = parsePercentInput(value);
  if (n == null) return sanitizePercentTyping(value);
  if (n === 0) return "";
  if (Number.isInteger(n)) return String(n);
  return String(parseFloat(n.toFixed(4)));
}

export function percentEqual(left, right) {
  const a = parsePercentInput(left);
  const b = parsePercentInput(right);
  if (a == null && b == null) return true;
  if ((a == null || a === 0) && (b == null || b === 0)) return true;
  if (a == null || b == null) return false;
  return Math.round(a * 10000) === Math.round(b * 10000);
}
