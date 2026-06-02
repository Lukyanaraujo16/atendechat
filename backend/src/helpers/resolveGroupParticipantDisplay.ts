import Contact from "../models/Contact";
import {
  isPlausibleWhatsAppPhoneNumber,
  normalizeWhatsAppJidToNumber
} from "./normalizeWhatsAppJidToNumber";

export type GroupParticipantDisplayInput = {
  contact?: { name?: string | null; number?: string | null } | null;
  participant?: string | null;
  dataJson?: string | null;
  pushName?: string | null;
};

export type GroupParticipantDisplayResult = {
  participantPhone: string | null;
  participantName: string | null;
  displayName: string;
};

/** Extrai dígitos do JID do participante (ignora @s.whatsapp.net, :device, @g.us). */
export function extractParticipantPhoneFromJid(
  jid: string | null | undefined
): string | null {
  if (jid == null || !String(jid).trim()) return null;
  const raw = String(jid).trim();
  if (raw.endsWith("@lid")) {
    return null;
  }
  const local = raw.split("@")[0].split(":")[0];
  const digits = local.replace(/\D/g, "");
  if (isPlausibleWhatsAppPhoneNumber(digits)) {
    return digits;
  }
  return null;
}

export function extractSenderPnFromDataJson(
  dataJson: string | null | undefined
): string | null {
  if (!dataJson) return null;
  try {
    const parsed = JSON.parse(dataJson) as {
      key?: { senderPn?: string; participantPn?: string; participant?: string };
      pushName?: string;
      participant?: string;
      senderPn?: string;
      participantPn?: string;
    };
    const key = parsed?.key;
    const pn = key?.senderPn ?? parsed?.senderPn;
    if (pn) {
      const d = normalizeWhatsAppJidToNumber(null, { senderPn: pn });
      if (d && isPlausibleWhatsAppPhoneNumber(d)) return d;
    }
    const ppn = key?.participantPn ?? parsed?.participantPn;
    if (ppn) {
      const d = normalizeWhatsAppJidToNumber(null, { participantPn: ppn });
      if (d && isPlausibleWhatsAppPhoneNumber(d)) return d;
    }
    const part = key?.participant ?? parsed?.participant;
    if (part) {
      return extractParticipantPhoneFromJid(part);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function extractPushNameFromDataJson(
  dataJson: string | null | undefined
): string | null {
  if (!dataJson) return null;
  try {
    const parsed = JSON.parse(dataJson) as { pushName?: string };
    const name = parsed?.pushName?.trim();
    return name || null;
  } catch {
    return null;
  }
}

/** Nome guardado no contact parece ID interno (LID) e não nome legível. */
export function isLikelyInternalParticipantId(
  name: string | null | undefined,
  number: string | null | undefined
): boolean {
  const n = String(name || "").trim();
  const num = String(number || "").trim();
  if (!n) return true;
  if (num && (n === num || n === num.replace(/\D/g, ""))) return true;
  if (/^\d{14,}$/.test(n.replace(/\D/g, ""))) return true;
  if (num === "LID" && (/^\d+$/.test(n) || n === "Cliente")) return true;
  return false;
}

export function formatParticipantPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const d = String(phone).replace(/\D/g, "");
  if (d.length < 8) return null;
  if (d.length >= 12 && d.startsWith("55")) {
    const cc = d.slice(0, 2);
    const rest = d.slice(2);
    if (rest.length === 11) {
      return `+${cc} (${rest.slice(0, 2)}) ${rest.slice(2, 7)}-${rest.slice(7)}`;
    }
    if (rest.length === 10) {
      return `+${cc} (${rest.slice(0, 2)}) ${rest.slice(2, 6)}-${rest.slice(6)}`;
    }
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return `+${d}`;
}

export function resolveGroupParticipantDisplay(
  input: GroupParticipantDisplayInput
): GroupParticipantDisplayResult {
  const phoneFromJid = extractParticipantPhoneFromJid(input.participant);
  const phoneFromJson = extractSenderPnFromDataJson(input.dataJson);
  const participantPhone = phoneFromJson || phoneFromJid;

  const pushName =
    (input.pushName && String(input.pushName).trim()) ||
    extractPushNameFromDataJson(input.dataJson) ||
    null;

  const contactName = input.contact?.name
    ? String(input.contact.name).trim()
    : null;
  const contactNumber = input.contact?.number
    ? String(input.contact.number).trim()
    : null;

  let participantName: string | null = null;

  if (contactName && !isLikelyInternalParticipantId(contactName, contactNumber)) {
    participantName = contactName;
  } else if (pushName) {
    participantName = pushName;
  } else if (participantPhone) {
    participantName = formatParticipantPhone(participantPhone);
  }

  const displayName =
    participantName ||
    formatParticipantPhone(participantPhone) ||
    "Participante";

  return {
    participantPhone,
    participantName,
    displayName
  };
}

/** Resolve JID estável para contact do participante (preferir número real vs @lid). */
export function resolveGroupParticipantContactJid(
  participant: string | null | undefined,
  dataJson?: string | null
): string | null {
  if (!participant) return null;
  const raw = String(participant).trim();
  if (raw.endsWith("@lid")) {
    const phone = extractSenderPnFromDataJson(dataJson);
    if (phone) return `${phone}@s.whatsapp.net`;
  }
  const phone = extractParticipantPhoneFromJid(raw);
  if (phone) return `${phone}@s.whatsapp.net`;
  return raw;
}

/**
 * Carrega contactos por número (lote) para participantes com nome inválido.
 */
export async function loadContactsByPhones(
  companyId: number,
  phones: string[]
): Promise<Map<string, Contact>> {
  const unique = [...new Set(phones.filter(Boolean))];
  const map = new Map<string, Contact>();
  if (!unique.length) return map;

  const rows = await Contact.findAll({
    where: { companyId, number: unique }
  });
  for (const c of rows) {
    const num = String(c.number || "").replace(/\D/g, "");
    if (num) map.set(num, c);
  }
  return map;
}
