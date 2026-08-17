/**
 * Lógica pura do spike de resolução de telefone em participantes de grupo.
 * Somente leitura — sem chamadas WhatsApp.
 */

import { BufferJSON } from "@whiskeysockets/baileys";
import { isPlausibleWhatsAppPhoneNumber } from "../../helpers/normalizeWhatsAppJidToNumber";

export type ResolutionCategory =
  | "withPhoneNumberField"
  | "withPnId"
  | "lidWithPnField"
  | "lidResolvedByMapping"
  | "unresolvedLid"
  | "invalidPhone";

export type SpikeParticipantInput = {
  id?: string | null;
  phoneNumber?: string | null;
  lid?: string | null;
};

export type SpikeParticipantResolution = {
  category: ResolutionCategory;
  resolvedPhone: string | null;
};

export type SpikeGroupInput = {
  groupJid: string;
  subject?: string | null;
  addressingMode?: string | null;
  participants: SpikeParticipantInput[];
};

export type SpikeGroupReport = {
  groupJidMasked: string;
  groupSubjectMasked: string | null;
  addressingMode: string | null;
  totalParticipants: number;
  withPhoneNumberField: number;
  withPnId: number;
  lidWithPnField: number;
  lidResolvedByMapping: number;
  unresolvedLid: number;
  invalidPhone: number;
  uniqueResolvedPhones: number;
  resolutionPercentage: number;
};

export type SpikeAggregateReport = {
  groupsAnalyzed: number;
  totalParticipants: number;
  withPhoneNumberField: number;
  withPnId: number;
  lidWithPnField: number;
  lidResolvedByMapping: number;
  unresolvedLid: number;
  invalidPhone: number;
  uniqueResolvedPhones: number;
  resolutionPercentage: number;
  pctWithPhoneNumberField: number;
  pctWithPnId: number;
  pctLidWithPnField: number;
  pctLidResolvedByMapping: number;
  pctUnresolvedLid: number;
  pctInvalidPhone: number;
  byAddressingMode: {
    lid: { groups: number; participants: number; resolved: number; pctResolved: number };
    pn: { groups: number; participants: number; resolved: number; pctResolved: number };
    unknown: { groups: number; participants: number; resolved: number; pctResolved: number };
  };
  groups: SpikeGroupReport[];
};

const PN_SUFFIXES = ["@s.whatsapp.net", "@hosted"];

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function isLidJid(jid: string | null | undefined): boolean {
  const raw = String(jid ?? "").trim().toLowerCase();
  return raw.endsWith("@lid") || raw.endsWith("@hosted.lid");
}

function isPnJid(jid: string | null | undefined): boolean {
  const raw = String(jid ?? "").trim().toLowerCase();
  if (!raw) return false;
  return PN_SUFFIXES.some(suffix => raw.endsWith(suffix));
}

function extractPhoneFromPnJid(jid: string | null | undefined): string | null {
  if (!isPnJid(jid)) return null;
  const local = String(jid).split("@")[0].split(":")[0];
  const digits = digitsOnly(local);
  return isPlausibleWhatsAppPhoneNumber(digits) ? digits : null;
}

function extractPhoneFromValue(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (isPnJid(raw)) {
    return extractPhoneFromPnJid(raw);
  }
  const digits = digitsOnly(raw);
  return isPlausibleWhatsAppPhoneNumber(digits) ? digits : null;
}

/** Mascara JID/grupo: mantém sufixo e primeiros dígitos do user. */
export function maskJid(jid: string | null | undefined): string {
  const raw = String(jid ?? "").trim();
  if (!raw) return "—";
  const [userPart, domain = ""] = raw.split("@");
  const user = userPart.split(":")[0];
  if (user.length <= 4) {
    return `****@${domain || "?"}`;
  }
  return `${user.slice(0, 4)}****@${domain || "?"}`;
}

/** Mascara telefone: ex. 5511999**** */
export function maskPhone(digits: string | null | undefined): string {
  const d = digitsOnly(digits);
  if (!d) return "—";
  if (d.length <= 4) return "****";
  const visible = Math.min(7, Math.max(4, d.length - 4));
  return `${d.slice(0, visible)}****`;
}

/** Mascara nome/assunto de grupo — não expor texto completo. */
export function maskLabel(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (raw.length <= 2) return "**";
  return `${raw.slice(0, 2)}*** (${raw.length} chars)`;
}

/**
 * Carrega mapa lidUser → pnUser a partir do JSON de sessão persistido (authState).
 * Espelha a leitura `{lidUser}_reverse` usada por LIDMappingStore.getPNForLID — somente leitura.
 */
export function loadLidToPnUserMapFromSessionJson(
  sessionJson: string | null | undefined
): Map<string, string> {
  const map = new Map<string, string>();
  if (!sessionJson) return map;

  let parsed: { keys?: Record<string, Record<string, string>> };
  try {
    parsed = JSON.parse(sessionJson, BufferJSON.reviver);
  } catch {
    return map;
  }

  const mapping = parsed?.keys?.["lid-mapping"];
  if (!mapping || typeof mapping !== "object") return map;

  for (const [key, value] of Object.entries(mapping)) {
    if (!key.endsWith("_reverse")) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    const lidUser = key.slice(0, -"_reverse".length);
    if (!lidUser) continue;
    map.set(lidUser, value);
  }

  return map;
}

function resolveParticipantPhoneFromMapping(
  participantId: string,
  lidToPnUser: Map<string, string>
): string | null {
  if (!isLidJid(participantId)) return null;
  const lidUser = participantId.split("@")[0].split(":")[0];
  const pnUser = lidToPnUser.get(lidUser);
  if (!pnUser) return null;
  return isPlausibleWhatsAppPhoneNumber(pnUser) ? pnUser : null;
}

/**
 * Classifica um participante em ordem de prioridade (mutuamente exclusivo).
 */
export function resolveSpikeParticipant(
  participant: SpikeParticipantInput,
  lidToPnUser: Map<string, string>
): SpikeParticipantResolution {
  const id = String(participant.id ?? "").trim();

  const fromPhoneNumberField = extractPhoneFromValue(participant.phoneNumber);
  if (fromPhoneNumberField) {
    return {
      category: "withPhoneNumberField",
      resolvedPhone: fromPhoneNumberField
    };
  }

  const fromPnId = extractPhoneFromPnJid(id);
  if (fromPnId) {
    return {
      category: "withPnId",
      resolvedPhone: fromPnId
    };
  }

  if (isLidJid(id)) {
    const otherPn =
      extractPhoneFromValue(participant.lid) ??
      extractPhoneFromPnJid(participant.lid);
    if (otherPn) {
      return {
        category: "lidWithPnField",
        resolvedPhone: otherPn
      };
    }

    const fromMapping = resolveParticipantPhoneFromMapping(id, lidToPnUser);
    if (fromMapping) {
      return {
        category: "lidResolvedByMapping",
        resolvedPhone: fromMapping
      };
    }

    return {
      category: "unresolvedLid",
      resolvedPhone: null
    };
  }

  const attempted = digitsOnly(id);
  if (attempted) {
    return {
      category: "invalidPhone",
      resolvedPhone: null
    };
  }

  return {
    category: "unresolvedLid",
    resolvedPhone: null
  };
}

function countByCategory(
  participants: SpikeParticipantInput[],
  lidToPnUser: Map<string, string>
): {
  totalParticipants: number;
  withPhoneNumberField: number;
  withPnId: number;
  lidWithPnField: number;
  lidResolvedByMapping: number;
  unresolvedLid: number;
  invalidPhone: number;
  resolvedPhones: Set<string>;
} {
  const counts = {
    totalParticipants: participants.length,
    withPhoneNumberField: 0,
    withPnId: 0,
    lidWithPnField: 0,
    lidResolvedByMapping: 0,
    unresolvedLid: 0,
    invalidPhone: 0,
    resolvedPhones: new Set<string>()
  };

  for (const participant of participants) {
    const result = resolveSpikeParticipant(participant, lidToPnUser);
    counts[result.category] += 1;
    if (result.resolvedPhone) {
      counts.resolvedPhones.add(result.resolvedPhone);
    }
  }

  return counts;
}

export function buildSpikeGroupReport(
  group: SpikeGroupInput,
  lidToPnUser: Map<string, string>
): SpikeGroupReport {
  const stats = countByCategory(group.participants, lidToPnUser);
  const resolvedCount =
    stats.withPhoneNumberField +
    stats.withPnId +
    stats.lidWithPnField +
    stats.lidResolvedByMapping;
  const resolutionPercentage =
    stats.totalParticipants > 0
      ? Math.round((resolvedCount / stats.totalParticipants) * 10000) / 100
      : 0;

  return {
    groupJidMasked: maskJid(group.groupJid),
    groupSubjectMasked: maskLabel(group.subject),
    addressingMode: group.addressingMode ?? null,
    totalParticipants: stats.totalParticipants,
    withPhoneNumberField: stats.withPhoneNumberField,
    withPnId: stats.withPnId,
    lidWithPnField: stats.lidWithPnField,
    lidResolvedByMapping: stats.lidResolvedByMapping,
    unresolvedLid: stats.unresolvedLid,
    invalidPhone: stats.invalidPhone,
    uniqueResolvedPhones: stats.resolvedPhones.size,
    resolutionPercentage
  };
}

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 10000) / 100;
}

function normalizeAddressingMode(value: string | null | undefined): "lid" | "pn" | "unknown" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "lid") return "lid";
  if (raw === "pn") return "pn";
  return "unknown";
}

export function analyzeSpikeGroups(
  rawGroups: SpikeGroupInput[],
  lidToPnUser: Map<string, string>
): SpikeAggregateReport {
  const groups = rawGroups.map(group => buildSpikeGroupReport(group, lidToPnUser));
  return buildSpikeAggregateReport(groups, rawGroups, lidToPnUser);
}

export function buildSpikeAggregateReport(
  groups: SpikeGroupReport[],
  rawGroups: SpikeGroupInput[] = [],
  lidToPnUser: Map<string, string> = new Map()
): SpikeAggregateReport {
  const totals = {
    groupsAnalyzed: groups.length,
    totalParticipants: 0,
    withPhoneNumberField: 0,
    withPnId: 0,
    lidWithPnField: 0,
    lidResolvedByMapping: 0,
    unresolvedLid: 0,
    invalidPhone: 0,
    uniqueResolvedPhones: 0
  };

  const modeBuckets = {
    lid: { groups: 0, participants: 0, resolved: 0 },
    pn: { groups: 0, participants: 0, resolved: 0 },
    unknown: { groups: 0, participants: 0, resolved: 0 }
  };

  const globalPhones = new Set<string>();

  for (const group of groups) {
    totals.totalParticipants += group.totalParticipants;
    totals.withPhoneNumberField += group.withPhoneNumberField;
    totals.withPnId += group.withPnId;
    totals.lidWithPnField += group.lidWithPnField;
    totals.lidResolvedByMapping += group.lidResolvedByMapping;
    totals.unresolvedLid += group.unresolvedLid;
    totals.invalidPhone += group.invalidPhone;

    const resolvedInGroup =
      group.withPhoneNumberField +
      group.withPnId +
      group.lidWithPnField +
      group.lidResolvedByMapping;

    const mode = normalizeAddressingMode(group.addressingMode);
    modeBuckets[mode].groups += 1;
    modeBuckets[mode].participants += group.totalParticipants;
    modeBuckets[mode].resolved += resolvedInGroup;
  }

  for (const rawGroup of rawGroups) {
    for (const participant of rawGroup.participants) {
      const result = resolveSpikeParticipant(participant, lidToPnUser);
      if (result.resolvedPhone) {
        globalPhones.add(result.resolvedPhone);
      }
    }
  }

  totals.uniqueResolvedPhones = globalPhones.size;

  const resolvedTotal =
    totals.withPhoneNumberField +
    totals.withPnId +
    totals.lidWithPnField +
    totals.lidResolvedByMapping;

  return {
    ...totals,
    uniqueResolvedPhones: totals.uniqueResolvedPhones,
    resolutionPercentage: pct(resolvedTotal, totals.totalParticipants),
    pctWithPhoneNumberField: pct(totals.withPhoneNumberField, totals.totalParticipants),
    pctWithPnId: pct(totals.withPnId, totals.totalParticipants),
    pctLidWithPnField: pct(totals.lidWithPnField, totals.totalParticipants),
    pctLidResolvedByMapping: pct(totals.lidResolvedByMapping, totals.totalParticipants),
    pctUnresolvedLid: pct(totals.unresolvedLid, totals.totalParticipants),
    pctInvalidPhone: pct(totals.invalidPhone, totals.totalParticipants),
    byAddressingMode: {
      lid: {
        ...modeBuckets.lid,
        pctResolved: pct(modeBuckets.lid.resolved, modeBuckets.lid.participants)
      },
      pn: {
        ...modeBuckets.pn,
        pctResolved: pct(modeBuckets.pn.resolved, modeBuckets.pn.participants)
      },
      unknown: {
        ...modeBuckets.unknown,
        pctResolved: pct(modeBuckets.unknown.resolved, modeBuckets.unknown.participants)
      }
    },
    groups
  };
}
