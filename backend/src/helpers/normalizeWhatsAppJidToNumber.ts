/**
 * Normalização de JID/número para contatos individuais (inbound WhatsApp).
 * Não usar para entidades de grupo (@g.us) — esses IDs têm regras próprias.
 */

import { logger } from "../utils/logger";

const MIN_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

/** Prefixo típico de ID interno de grupo/comunidade WhatsApp (não é telefone). */
const WHATSAPP_GROUP_ID_PREFIX = /^120363\d+$/;

/** IDs internos de mensagem/dispositivo (ex.: 3EB0…, false_…). */
const INTERNAL_NON_PHONE_LOCAL = /^(3eb0|false_)/i;

export type WhatsAppJidNormalizeOptions = {
  senderPn?: string | null;
  remoteJidAlt?: string | null;
  participantPn?: string | null;
};

export type InboundJidMeta = {
  remoteJid: string;
  participant: string;
  senderPn?: string;
  remoteJidAlt?: string;
  participantPn?: string;
  fromMe?: boolean;
};

export type ResolvedInboundContact = {
  number: string;
  jidForProfile: string;
  source: string;
};

export type ResolveInboundContactResult =
  | { ok: true; data: ResolvedInboundContact; meta: InboundJidMeta }
  | {
      ok: false;
      reason: string;
      meta: InboundJidMeta;
      ticketCandidate: boolean;
    };

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/**
 * JIDs que não devem virar contato individual (extração de telefone).
 * @lid e @g.us não são telefone, mas mensagens com esses JIDs podem ser válidas.
 */
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

/** Mensagens que o listener deve ignorar por completo (não é chat de atendimento). */
export function isIgnorableInboundRemoteJid(jid: string | null | undefined): boolean {
  const raw = String(jid ?? "").trim().toLowerCase();
  if (!raw) return true;
  if (raw === "status@broadcast") return true;
  if (raw.endsWith("@broadcast") && !raw.endsWith("@s.whatsapp.net")) return true;
  if (raw.endsWith("@newsletter")) return true;
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

function logContactNormalizationResolved(
  source: string,
  number: string,
  jid: string,
  meta: InboundJidMeta
): void {
  logger.info(
    {
      source,
      number,
      jid,
      remoteJid: meta.remoteJid,
      participant: meta.participant,
      senderPn: meta.senderPn,
      remoteJidAlt: meta.remoteJidAlt,
      participantPn: meta.participantPn
    },
    "[ContactNormalization][RESOLVED]"
  );
}

function logContactNormalizationFailed(
  reason: string,
  meta: InboundJidMeta,
  ticketCandidate: boolean,
  messageType?: string
): void {
  logger.warn(
    {
      ticketCandidate,
      remoteJid: meta.remoteJid,
      participant: meta.participant,
      senderPn: meta.senderPn,
      remoteJidAlt: meta.remoteJidAlt,
      participantPn: meta.participantPn,
      fromMe: meta.fromMe,
      messageType,
      isGroup: meta.remoteJid.includes("@g.us"),
      isBroadcast:
        meta.remoteJid.includes("@broadcast") ||
        meta.remoteJid === "status@broadcast",
      isNewsletter: meta.remoteJid.includes("newsletter"),
      reason
    },
    "[ContactNormalization][FAILED]"
  );
}

/**
 * Converte JID (ou senderPn) em número real (somente dígitos) ou null se inválido.
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

  if (options.participantPn) {
    const fromPpn = digitsOnly(options.participantPn);
    if (isPlausibleWhatsAppPhoneNumber(fromPpn)) {
      return fromPpn;
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
  readonly reason: string;

  constructor(jid: string, reason = "no_plausible_number") {
    super(`Invalid inbound contact JID: ${jid} (${reason})`);
    this.name = "InvalidInboundContactJidError";
    this.jid = jid;
    this.reason = reason;
  }
}

export function extractInboundJidMeta(msg: {
  key?: {
    remoteJid?: string | null;
    participant?: string | null;
    fromMe?: boolean | null;
    senderPn?: string;
    remoteJidAlt?: string;
    participantPn?: string;
  };
  participant?: string | null;
  senderPn?: string;
  participantPn?: string;
}): InboundJidMeta {
  const key = (msg.key || {}) as {
    remoteJid?: string | null;
    participant?: string | null;
    fromMe?: boolean | null;
    senderPn?: string;
    remoteJidAlt?: string;
    participantPn?: string;
  };
  const loose = msg as {
    senderPn?: string;
    participantPn?: string;
    participant?: string | null;
  };

  return {
    remoteJid: String(key.remoteJid || ""),
    participant: String(key.participant || loose.participant || ""),
    senderPn: key.senderPn ?? loose.senderPn,
    remoteJidAlt: key.remoteJidAlt,
    participantPn: key.participantPn ?? loose.participantPn,
    fromMe: Boolean(key.fromMe)
  };
}

type ResolveInboundOptions = {
  isGroup?: boolean;
  messageType?: string;
  tryOnWhatsApp?: (jid: string) => Promise<string | null>;
};

/**
 * Resolve número real do cliente tentando todas as fontes Baileys conhecidas.
 */
export async function resolveInboundContactFromMessage(
  msg: {
    key?: {
      remoteJid?: string | null;
      participant?: string | null;
      fromMe?: boolean | null;
      senderPn?: string;
      remoteJidAlt?: string;
      participantPn?: string;
    };
    participant?: string | null;
    senderPn?: string;
    participantPn?: string;
  },
  options: ResolveInboundOptions = {}
): Promise<ResolveInboundContactResult> {
  const meta = extractInboundJidMeta(msg);
  const isGroup = options.isGroup ?? meta.remoteJid.includes("@g.us");
  const normalizeOpts: WhatsAppJidNormalizeOptions = {
    senderPn: meta.senderPn,
    remoteJidAlt: meta.remoteJidAlt,
    participantPn: meta.participantPn
  };

  const ticketCandidate =
    !isGroup &&
    !meta.fromMe &&
    !isIgnorableInboundRemoteJid(meta.remoteJid);

  if (isIgnorableInboundRemoteJid(meta.remoteJid)) {
    logContactNormalizationFailed(
      "ignorable_remote_jid",
      meta,
      false,
      options.messageType
    );
    return {
      ok: false,
      reason: "ignorable_remote_jid",
      meta,
      ticketCandidate: false
    };
  }

  const trySources: Array<{ source: string; number: string | null }> = [
    {
      source: "senderPn",
      number: normalizeWhatsAppJidToNumber(null, {
        senderPn: meta.senderPn
      })
    },
    {
      source: "participantPn",
      number: normalizeWhatsAppJidToNumber(null, {
        participantPn: meta.participantPn
      })
    },
    {
      source: "remoteJidAlt",
      number: normalizeWhatsAppJidToNumber(meta.remoteJidAlt, normalizeOpts)
    },
    {
      source: "participant",
      number: normalizeWhatsAppJidToNumber(meta.participant, normalizeOpts)
    }
  ];

  if (!isGroup) {
    trySources.push({
      source: "remoteJid",
      number: normalizeWhatsAppJidToNumber(meta.remoteJid, normalizeOpts)
    });
  }

  for (const { source, number } of trySources) {
    const jid = jidFromWhatsAppPhoneNumber(number);
    if (number && jid) {
      logContactNormalizationResolved(source, number, jid, meta);
      return {
        ok: true,
        data: { number, jidForProfile: jid, source },
        meta
      };
    }
  }

  if (options.tryOnWhatsApp) {
    const jidsToProbe = [
      meta.remoteJidAlt,
      ...(isGroup ? [] : [meta.remoteJid]),
      meta.participant
    ].filter((j) => j && !isIgnorableInboundRemoteJid(j));

    for (const probeJid of jidsToProbe) {
      try {
        const fromWa = await options.tryOnWhatsApp(probeJid);
        const jid = jidFromWhatsAppPhoneNumber(fromWa);
        if (fromWa && jid) {
          logContactNormalizationResolved("onWhatsApp", fromWa, jid, meta);
          return {
            ok: true,
            data: {
              number: fromWa,
              jidForProfile: jid,
              source: "onWhatsApp"
            },
            meta
          };
        }
      } catch {
        /* próximo JID */
      }
    }
  }

  logContactNormalizationFailed(
    "no_plausible_number",
    meta,
    ticketCandidate,
    options.messageType
  );

  return {
    ok: false,
    reason: "no_plausible_number",
    meta,
    ticketCandidate
  };
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
      participantPn?: string;
    };
    participant?: string | null;
    senderPn?: string;
    participantPn?: string;
  },
  fallbackParticipant?: string | null
): string | null {
  const meta = extractInboundJidMeta(msg);
  const participant = meta.participant || fallbackParticipant || null;
  const number = normalizeWhatsAppJidToNumber(participant, {
    senderPn: meta.senderPn,
    remoteJidAlt: meta.remoteJidAlt,
    participantPn: meta.participantPn
  });
  if (number) {
    return jidFromWhatsAppPhoneNumber(number);
  }
  return null;
}

/**
 * JID de chat 1:1 para envio (@s.whatsapp.net) quando o número foi resolvido.
 */
export function resolvePrivateChatJid(msg: {
  key?: {
    remoteJid?: string | null;
    senderPn?: string;
    remoteJidAlt?: string;
    participantPn?: string;
    participant?: string | null;
  };
  participant?: string | null;
}): string | null {
  const meta = extractInboundJidMeta(msg);
  if (meta.remoteJid.endsWith("@g.us")) {
    return meta.remoteJid;
  }
  if (isIgnorableInboundRemoteJid(meta.remoteJid)) {
    return null;
  }

  const number = normalizeWhatsAppJidToNumber(meta.remoteJid, {
    senderPn: meta.senderPn,
    remoteJidAlt: meta.remoteJidAlt,
    participantPn: meta.participantPn
  });
  if (number) {
    return jidFromWhatsAppPhoneNumber(number);
  }

  if (
    meta.remoteJidAlt &&
    !isIgnorableInboundRemoteJid(meta.remoteJidAlt) &&
    !isRejectableWhatsAppJid(meta.remoteJidAlt)
  ) {
    return meta.remoteJidAlt;
  }

  if (meta.remoteJid && !isIgnorableInboundRemoteJid(meta.remoteJid)) {
    return meta.remoteJid;
  }

  return null;
}
