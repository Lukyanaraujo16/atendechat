/**
 * Normalização de JID/número para contatos individuais (inbound WhatsApp).
 * Não usar para entidades de grupo (@g.us) — esses IDs têm regras próprias.
 */

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

/** Prefixo típico de ID interno de grupo/comunidade WhatsApp (não é telefone). */
const WHATSAPP_GROUP_ID_PREFIX = /^120363\d+$/;

/** IDs internos de mensagem/dispositivo (ex.: 3EB0…, false_…). */
const INTERNAL_NON_PHONE_LOCAL = /^(3eb0|false_)/i;

export type WhatsAppJidNormalizeOptions = {
  senderPn?: string | null;
  remoteJidAlt?: string | null;
};

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isRejectableWhatsAppJid(jid: string | null | undefined): boolean {
  const raw = String(jid ?? "").trim().toLowerCase();
  if (!raw) return true;
  if (raw === "status@broadcast") return true;
  if (raw.endsWith("@g.us")) return true;
  if (raw.endsWith("@broadcast")) return true;
  if (raw.endsWith("@newsletter")) return true;
  if (raw.endsWith("@lid")) return true;
  if (raw.endsWith("@c.us") && INTERNAL_NON_PHONE_LOCAL.test(raw.split("@")[0])) {
    return true;
  }
  if (raw.includes("newsletter")) return true;
  return false;
}

/** Telefone plausível E.164 (somente dígitos, 10–15). */
export function isPlausibleWhatsAppPhoneNumber(
  digits: string | null | undefined
): boolean {
  const d = digitsOnly(digits);
  if (!d || d.length < MIN_PHONE_DIGITS || d.length > MAX_PHONE_DIGITS) {
    return false;
  }
  if (/^(\d)\1{9,}$/.test(d)) {
    return false;
  }
  if (WHATSAPP_GROUP_ID_PREFIX.test(d)) {
    return false;
  }
  return true;
}

function digitsFromJidLocalPart(jid: string): string | null {
  const raw = String(jid).trim();
  if (!raw || isRejectableWhatsAppJid(raw)) {
    return null;
  }
  const local = raw.split("@")[0].split(":")[0];
  if (!local || INTERNAL_NON_PHONE_LOCAL.test(local)) {
    return null;
  }
  const digits = digitsOnly(local);
  return digits || null;
}

/**
 * Converte JID (ou senderPn) em número real (somente dígitos) ou null se inválido.
 * Nunca retorna IDs @lid, @g.us, broadcast, newsletter ou IDs internos longos.
 */
export function normalizeWhatsAppJidToNumber(
  jid: string | null | undefined,
  options: WhatsAppJidNormalizeOptions = {}
): string | null {
  if (options.senderPn) {
    const fromPn = digitsOnly(options.senderPn);
    if (isPlausibleWhatsAppPhoneNumber(fromPn)) {
      return fromPn;
    }
  }

  if (options.remoteJidAlt && !isRejectableWhatsAppJid(options.remoteJidAlt)) {
    const fromAlt = digitsFromJidLocalPart(options.remoteJidAlt);
    if (fromAlt && isPlausibleWhatsAppPhoneNumber(fromAlt)) {
      return fromAlt;
    }
  }

  if (!jid) {
    return null;
  }

  const raw = String(jid).trim();
  if (raw.endsWith("@lid")) {
    return null;
  }

  const digits = digitsFromJidLocalPart(raw);
  if (!digits || !isPlausibleWhatsAppPhoneNumber(digits)) {
    return null;
  }

  return digits;
}

export function jidFromWhatsAppPhoneNumber(
  number: string | null | undefined
): string | null {
  const d = digitsOnly(number);
  if (!isPlausibleWhatsAppPhoneNumber(d)) {
    return null;
  }
  return `${d}@s.whatsapp.net`;
}

export class InvalidInboundContactJidError extends Error {
  readonly jid: string;

  constructor(jid: string) {
    super(`Invalid inbound contact JID: ${jid}`);
    this.name = "InvalidInboundContactJidError";
    this.jid = jid;
  }
}

/**
 * JID do participante em grupo (1:1 dentro do grupo) ou null se não houver número plausível.
 */
export function resolveGroupParticipantJid(
  msg: {
    key?: {
      participant?: string | null;
      senderPn?: string;
      remoteJidAlt?: string;
    };
    participant?: string | null;
  },
  fallbackParticipant?: string | null
): string | null {
  const meta = extractInboundJidMeta(msg);
  const participant =
    meta.participant || fallbackParticipant || null;
  const number = normalizeWhatsAppJidToNumber(participant, {
    senderPn: meta.senderPn,
    remoteJidAlt: meta.remoteJidAlt
  });
  if (number) {
    return jidFromWhatsAppPhoneNumber(number);
  }
  return null;
}

/**
 * JID de chat 1:1 para envio/armazenamento (@s.whatsapp.net) ou null se inválido.
 */
export function resolvePrivateChatJid(msg: {
  key?: {
    remoteJid?: string | null;
    senderPn?: string;
    remoteJidAlt?: string;
  };
}): string | null {
  const meta = extractInboundJidMeta(msg);
  if (isRejectableWhatsAppJid(meta.remoteJid)) {
    return null;
  }
  if (meta.remoteJid.endsWith("@g.us")) {
    return meta.remoteJid;
  }
  const number = normalizeWhatsAppJidToNumber(meta.remoteJid, {
    senderPn: meta.senderPn,
    remoteJidAlt: meta.remoteJidAlt
  });
  return number ? jidFromWhatsAppPhoneNumber(number) : null;
}

export function extractInboundJidMeta(msg: {
  key?: {
    remoteJid?: string | null;
    participant?: string | null;
    senderPn?: string;
    remoteJidAlt?: string;
  };
  participant?: string | null;
}): {
  remoteJid: string;
  participant: string;
  senderPn?: string;
  remoteJidAlt?: string;
} {
  const key = (msg.key || {}) as {
    remoteJid?: string | null;
    participant?: string | null;
    senderPn?: string;
    remoteJidAlt?: string;
  };
  return {
    remoteJid: String(key.remoteJid || ""),
    participant: String(key.participant || key.participant || ""),
    senderPn: key.senderPn,
    remoteJidAlt: key.remoteJidAlt
  };
}
