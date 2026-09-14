/**
 * Parser mínimo de contato compartilhado (vCard / contactMessage).
 * Extrai FN e TEL. Não é destrutivo e não cobre o vCard completo.
 */

export const SHARED_CONTACT_MEDIA_TYPES = new Set([
  "vcard",
  "contactMessage",
  "contactsArrayMessage",
]);

const VCARD_BEGIN = /BEGIN:VCARD/i;
const PLACEHOLDER_NAMES = new Set([
  "varios contatos",
  "vários contatos",
  "contato",
  "contact",
]);

export function isSharedContactMediaType(mediaType) {
  return SHARED_CONTACT_MEDIA_TYPES.has(mediaType);
}

export function looksLikeVcardBody(body) {
  return VCARD_BEGIN.test(String(body || ""));
}

function unescapeVcardValue(value) {
  return String(value || "")
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function readVcardField(raw, fieldName) {
  const pattern = new RegExp(`^${fieldName}[^:]*:(.*)$`, "im");
  const match = String(raw || "").match(pattern);
  return match ? unescapeVcardValue(match[1]) : "";
}

function nameFromNField(nValue) {
  if (!nValue) return "";
  const parts = nValue.split(";");
  const family = unescapeVcardValue(parts[0] || "");
  const given = unescapeVcardValue(parts[1] || "");
  return [given, family].filter(Boolean).join(" ").trim();
}

/**
 * @param {string|null|undefined} body
 * @returns {{ name: string, phone: string, displayName: string, isVcard: boolean }}
 */
export function parseSharedContact(body) {
  const raw = String(body || "");
  const isVcard = looksLikeVcardBody(raw);

  if (isVcard) {
    const fn = readVcardField(raw, "FN");
    const n = readVcardField(raw, "N");
    const tel = readVcardField(raw, "TEL");
    const name = fn || nameFromNField(n);
    return {
      name,
      phone: tel,
      displayName: name || tel || "Contato",
      isVcard: true,
    };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { name: "", phone: "", displayName: "Contato", isVcard: false };
  }

  if (PLACEHOLDER_NAMES.has(trimmed.toLowerCase())) {
    return {
      name: "",
      phone: "",
      displayName: "Contato",
      isVcard: false,
    };
  }

  if (!trimmed.includes("\n") && trimmed.length <= 80) {
    return {
      name: trimmed,
      phone: "",
      displayName: trimmed,
      isVcard: false,
    };
  }

  return { name: "", phone: "", displayName: "Contato", isVcard: false };
}

export default parseSharedContact;
