/**
 * Lógica pura do spike de resolução de telefone em participantes de grupo.
 * Somente leitura — sem chamadas WhatsApp nesta lib.
 */

import { isPlausibleWhatsAppPhoneNumber } from "../../helpers/normalizeWhatsAppJidToNumber";

export type ResolutionCategory =
  | "withPhoneNumberField"
  | "withPnId"
  | "lidWithPnField"
  | "lidResolvedByMapping"
  | "lidResolvedByRuntimeKeyStore"
  | "unresolvedLid"
  | "invalidPhone";

export type SpikeParticipantInput = {
  id?: string | null;
  phoneNumber?: string | null;
  lid?: string | null;
  name?: string | null;
  notify?: string | null;
  verifiedName?: string | null;
  imgUrl?: string | null;
  status?: string | null;
  admin?: string | null;
  isAdmin?: boolean | null;
  isSuperAdmin?: boolean | null;
  /** Chaves presentes no objeto retornado pelo Baileys (para shape audit). */
  presentKeys?: string[];
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
  lidResolvedByRuntimeKeyStore: number;
  unresolvedLid: number;
  invalidPhone: number;
  uniqueResolvedPhones: number;
  resolutionPercentage: number;
};

export type ParticipantShapeStats = {
  total: number;
  hasId: number;
  idIsLid: number;
  idIsPn: number;
  hasPhoneNumber: number;
  phoneNumberIsPnJid: number;
  hasLidField: number;
  lidFieldIsLidJid: number;
  hasName: number;
  hasNotify: number;
  hasVerifiedName: number;
  hasImgUrl: number;
  hasStatus: number;
  hasAdmin: number;
  adminIsSuperadmin: number;
  adminIsAdmin: number;
  hasIsAdmin: number;
  hasIsSuperAdmin: number;
  extraKeys: Record<string, number>;
};

export type MaskedFieldDescriptor = {
  field: string;
  type: string;
  length?: number;
  suffix?: string;
  masked?: string;
};

export type RuntimeMappingAudit = {
  unresolvedChecked: number;
  foundInRuntimeKeyStore: number;
  notFoundInRuntimeKeyStore: number;
  foundInRuntimeNotInSessionJson: number;
  foundInSessionJsonAndRuntime: number;
};

export type SessionMappingAudit = {
  sessionJsonReverseEntries: number;
  sessionJsonForwardEntries: number;
  sessionJsonTotalKeys: number;
};

export type SpikePhase2Report = {
  resolvedShape: ParticipantShapeStats;
  unresolvedShape: ParticipantShapeStats;
  resolvedSamples: MaskedFieldDescriptor[][];
  unresolvedSamples: MaskedFieldDescriptor[][];
  runtimeMappingAudit: RuntimeMappingAudit;
  sessionMappingAudit: SessionMappingAudit;
};

export type SpikeAggregateReport = {
  groupsAnalyzed: number;
  totalParticipants: number;
  withPhoneNumberField: number;
  withPnId: number;
  lidWithPnField: number;
  lidResolvedByMapping: number;
  lidResolvedByRuntimeKeyStore: number;
  unresolvedLid: number;
  invalidPhone: number;
  uniqueResolvedPhones: number;
  resolutionPercentage: number;
  pctWithPhoneNumberField: number;
  pctWithPnId: number;
  pctLidWithPnField: number;
  pctLidResolvedByMapping: number;
  pctLidResolvedByRuntimeKeyStore: number;
  pctUnresolvedLid: number;
  pctInvalidPhone: number;
  byAddressingMode: {
    lid: { groups: number; participants: number; resolved: number; pctResolved: number };
    pn: { groups: number; participants: number; resolved: number; pctResolved: number };
    unknown: { groups: number; participants: number; resolved: number; pctResolved: number };
  };
  phase2?: SpikePhase2Report;
  groups: SpikeGroupReport[];
};

const PN_SUFFIXES = ["@s.whatsapp.net", "@hosted"];
const KNOWN_PARTICIPANT_KEYS = new Set([
  "id",
  "phoneNumber",
  "lid",
  "name",
  "notify",
  "verifiedName",
  "imgUrl",
  "status",
  "admin",
  "isAdmin",
  "isSuperAdmin",
  "presentKeys"
]);

const MAX_STRUCTURAL_SAMPLES = 3;

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isLidJid(jid: string | null | undefined): boolean {
  const raw = String(jid ?? "").trim().toLowerCase();
  return raw.endsWith("@lid") || raw.endsWith("@hosted.lid");
}

export function isPnJid(jid: string | null | undefined): boolean {
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

export function extractLidUserFromJid(jid: string | null | undefined): string | null {
  if (!isLidJid(jid)) return null;
  const user = String(jid).split("@")[0].split(":")[0];
  return user || null;
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

export function describeMaskedField(
  field: string,
  value: unknown
): MaskedFieldDescriptor | null {
  if (value === undefined) return null;

  if (value === null) {
    return { field, type: "null" };
  }

  if (typeof value === "boolean") {
    return { field, type: "boolean", masked: value ? "true" : "false" };
  }

  if (typeof value === "number") {
    return { field, type: "number", masked: String(value) };
  }

  if (typeof value !== "string") {
    return { field, type: typeof value };
  }

  const raw = value.trim();
  if (!raw) {
    return { field, type: "string", length: 0 };
  }

  const suffix = raw.includes("@") ? `@${raw.split("@").pop()}` : undefined;

  if (field === "id" || field === "lid" || field === "phoneNumber") {
    return {
      field,
      type: "string",
      length: raw.length,
      suffix,
      masked: maskJid(raw)
    };
  }

  if (["name", "notify", "verifiedName", "status"].includes(field)) {
    return {
      field,
      type: "string",
      length: raw.length,
      masked: maskLabel(raw) || "**"
    };
  }

  return {
    field,
    type: "string",
    length: raw.length,
    suffix,
    masked: raw.length > 4 ? `${raw.slice(0, 2)}***` : "****"
  };
}

export function buildMaskedStructuralSample(
  participant: SpikeParticipantInput
): MaskedFieldDescriptor[] {
  const fields: Array<keyof SpikeParticipantInput> = [
    "id",
    "phoneNumber",
    "lid",
    "name",
    "notify",
    "verifiedName",
    "imgUrl",
    "status",
    "admin",
    "isAdmin",
    "isSuperAdmin"
  ];

  const sample: MaskedFieldDescriptor[] = [];
  for (const field of fields) {
    const descriptor = describeMaskedField(field, participant[field]);
    if (descriptor) sample.push(descriptor);
  }

  for (const key of participant.presentKeys || []) {
    if (KNOWN_PARTICIPANT_KEYS.has(key)) continue;
    sample.push({ field: key, type: "present", masked: "(extra key)" });
  }

  return sample;
}

function emptyShapeStats(): ParticipantShapeStats {
  return {
    total: 0,
    hasId: 0,
    idIsLid: 0,
    idIsPn: 0,
    hasPhoneNumber: 0,
    phoneNumberIsPnJid: 0,
    hasLidField: 0,
    lidFieldIsLidJid: 0,
    hasName: 0,
    hasNotify: 0,
    hasVerifiedName: 0,
    hasImgUrl: 0,
    hasStatus: 0,
    hasAdmin: 0,
    adminIsSuperadmin: 0,
    adminIsAdmin: 0,
    hasIsAdmin: 0,
    hasIsSuperAdmin: 0,
    extraKeys: {}
  };
}

function bumpExtraKey(stats: ParticipantShapeStats, key: string): void {
  stats.extraKeys[key] = (stats.extraKeys[key] || 0) + 1;
}

export function aggregateParticipantShape(
  participant: SpikeParticipantInput
): ParticipantShapeStats {
  const stats = emptyShapeStats();
  stats.total = 1;

  if (participant.id) {
    stats.hasId = 1;
    if (isLidJid(participant.id)) stats.idIsLid = 1;
    if (isPnJid(participant.id)) stats.idIsPn = 1;
  }

  if (participant.phoneNumber) {
    stats.hasPhoneNumber = 1;
    if (isPnJid(participant.phoneNumber)) stats.phoneNumberIsPnJid = 1;
  }

  if (participant.lid) {
    stats.hasLidField = 1;
    if (isLidJid(participant.lid)) stats.lidFieldIsLidJid = 1;
  }

  if (participant.name) stats.hasName = 1;
  if (participant.notify) stats.hasNotify = 1;
  if (participant.verifiedName) stats.hasVerifiedName = 1;
  if (participant.imgUrl) stats.hasImgUrl = 1;
  if (participant.status) stats.hasStatus = 1;

  if (participant.admin) {
    stats.hasAdmin = 1;
    if (participant.admin === "superadmin") stats.adminIsSuperadmin = 1;
    if (participant.admin === "admin") stats.adminIsAdmin = 1;
  }

  if (participant.isAdmin === true) stats.hasIsAdmin = 1;
  if (participant.isSuperAdmin === true) stats.hasIsSuperAdmin = 1;

  for (const key of participant.presentKeys || []) {
    if (!KNOWN_PARTICIPANT_KEYS.has(key)) bumpExtraKey(stats, key);
  }

  return stats;
}

export function mergeShapeStats(
  target: ParticipantShapeStats,
  addition: ParticipantShapeStats
): void {
  target.total += addition.total;
  target.hasId += addition.hasId;
  target.idIsLid += addition.idIsLid;
  target.idIsPn += addition.idIsPn;
  target.hasPhoneNumber += addition.hasPhoneNumber;
  target.phoneNumberIsPnJid += addition.phoneNumberIsPnJid;
  target.hasLidField += addition.hasLidField;
  target.lidFieldIsLidJid += addition.lidFieldIsLidJid;
  target.hasName += addition.hasName;
  target.hasNotify += addition.hasNotify;
  target.hasVerifiedName += addition.hasVerifiedName;
  target.hasImgUrl += addition.hasImgUrl;
  target.hasStatus += addition.hasStatus;
  target.hasAdmin += addition.hasAdmin;
  target.adminIsSuperadmin += addition.adminIsSuperadmin;
  target.adminIsAdmin += addition.adminIsAdmin;
  target.hasIsAdmin += addition.hasIsAdmin;
  target.hasIsSuperAdmin += addition.hasIsSuperAdmin;

  for (const [key, count] of Object.entries(addition.extraKeys)) {
    target.extraKeys[key] = (target.extraKeys[key] || 0) + count;
  }
}

/**
 * Carrega mapa lidUser → pnUser a partir do JSON de sessão persistido (authState).
 */
export function loadLidToPnUserMapFromSessionJson(
  sessionJson: string | null | undefined
): Map<string, string> {
  const map = new Map<string, string>();
  const mapping = loadRawLidMappingObject(sessionJson);

  for (const [key, value] of Object.entries(mapping)) {
    if (!key.endsWith("_reverse")) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    const lidUser = key.slice(0, -"_reverse".length);
    if (!lidUser) continue;
    map.set(lidUser, value);
  }

  return map;
}

export function loadRawLidMappingObject(
  sessionJson: string | null | undefined
): Record<string, string> {
  if (!sessionJson) return {};
  try {
    const parsed = JSON.parse(sessionJson) as {
      keys?: Record<string, Record<string, string>>;
    };
    const mapping = parsed?.keys?.["lid-mapping"];
    return mapping && typeof mapping === "object" ? mapping : {};
  } catch {
    return {};
  }
}

export function auditSessionLidMapping(
  sessionJson: string | null | undefined
): SessionMappingAudit {
  const mapping = loadRawLidMappingObject(sessionJson);
  const keys = Object.keys(mapping);
  const reverse = keys.filter(k => k.endsWith("_reverse")).length;
  const forward = keys.filter(k => !k.endsWith("_reverse")).length;
  return {
    sessionJsonReverseEntries: reverse,
    sessionJsonForwardEntries: forward,
    sessionJsonTotalKeys: keys.length
  };
}

function resolveParticipantPhoneFromMapping(
  participantId: string,
  lidToPnUser: Map<string, string>
): string | null {
  const lidUser = extractLidUserFromJid(participantId);
  if (!lidUser) return null;
  const pnUser = lidToPnUser.get(lidUser);
  if (!pnUser) return null;
  return isPlausibleWhatsAppPhoneNumber(pnUser) ? pnUser : null;
}

export type ResolveSpikeParticipantOptions = {
  sessionLidToPn?: Map<string, string>;
  runtimeLidToPn?: Map<string, string>;
};

/**
 * Classifica um participante em ordem de prioridade (mutuamente exclusivo).
 */
export function resolveSpikeParticipant(
  participant: SpikeParticipantInput,
  sessionLidToPn: Map<string, string> = new Map(),
  options: ResolveSpikeParticipantOptions = {}
): SpikeParticipantResolution {
  const runtimeLidToPn = options.runtimeLidToPn ?? new Map();
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

    const fromSession = resolveParticipantPhoneFromMapping(id, sessionLidToPn);
    if (fromSession) {
      return {
        category: "lidResolvedByMapping",
        resolvedPhone: fromSession
      };
    }

    const fromRuntime = resolveParticipantPhoneFromMapping(id, runtimeLidToPn);
    if (fromRuntime) {
      return {
        category: "lidResolvedByRuntimeKeyStore",
        resolvedPhone: fromRuntime
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

export function isResolvedCategory(category: ResolutionCategory): boolean {
  return (
    category === "withPhoneNumberField" ||
    category === "withPnId" ||
    category === "lidWithPnField" ||
    category === "lidResolvedByMapping" ||
    category === "lidResolvedByRuntimeKeyStore"
  );
}

function countByCategory(
  participants: SpikeParticipantInput[],
  sessionLidToPn: Map<string, string>,
  runtimeLidToPn: Map<string, string>
): {
  totalParticipants: number;
  withPhoneNumberField: number;
  withPnId: number;
  lidWithPnField: number;
  lidResolvedByMapping: number;
  lidResolvedByRuntimeKeyStore: number;
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
    lidResolvedByRuntimeKeyStore: 0,
    unresolvedLid: 0,
    invalidPhone: 0,
    resolvedPhones: new Set<string>()
  };

  for (const participant of participants) {
    const result = resolveSpikeParticipant(participant, sessionLidToPn, {
      runtimeLidToPn
    });
    counts[result.category] += 1;
    if (result.resolvedPhone) {
      counts.resolvedPhones.add(result.resolvedPhone);
    }
  }

  return counts;
}

export function buildSpikeGroupReport(
  group: SpikeGroupInput,
  sessionLidToPn: Map<string, string>,
  runtimeLidToPn: Map<string, string> = new Map()
): SpikeGroupReport {
  const stats = countByCategory(
    group.participants,
    sessionLidToPn,
    runtimeLidToPn
  );
  const resolvedCount =
    stats.withPhoneNumberField +
    stats.withPnId +
    stats.lidWithPnField +
    stats.lidResolvedByMapping +
    stats.lidResolvedByRuntimeKeyStore;
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
    lidResolvedByRuntimeKeyStore: stats.lidResolvedByRuntimeKeyStore,
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

export function buildPhase2Report(
  rawGroups: SpikeGroupInput[],
  sessionLidToPn: Map<string, string>,
  runtimeLidToPn: Map<string, string>,
  sessionJson: string | null | undefined
): SpikePhase2Report {
  const resolvedShape = emptyShapeStats();
  const unresolvedShape = emptyShapeStats();
  const resolvedSamples: MaskedFieldDescriptor[][] = [];
  const unresolvedSamples: MaskedFieldDescriptor[][] = [];

  let unresolvedChecked = 0;
  let foundInRuntimeKeyStore = 0;
  let foundInRuntimeNotInSessionJson = 0;
  let foundInSessionJsonAndRuntime = 0;

  for (const group of rawGroups) {
    for (const participant of group.participants) {
      const resolution = resolveSpikeParticipant(participant, sessionLidToPn, {
        runtimeLidToPn
      });
      const shape = aggregateParticipantShape(participant);

      if (isResolvedCategory(resolution.category)) {
        mergeShapeStats(resolvedShape, shape);
        if (resolvedSamples.length < MAX_STRUCTURAL_SAMPLES) {
          resolvedSamples.push(buildMaskedStructuralSample(participant));
        }
      } else if (resolution.category === "unresolvedLid") {
        mergeShapeStats(unresolvedShape, shape);
        if (unresolvedSamples.length < MAX_STRUCTURAL_SAMPLES) {
          unresolvedSamples.push(buildMaskedStructuralSample(participant));
        }

        const lidUser = extractLidUserFromJid(participant.id);
        if (lidUser) {
          unresolvedChecked += 1;
          const inSession = sessionLidToPn.has(lidUser);
          const inRuntime = runtimeLidToPn.has(lidUser);
          if (inRuntime) {
            foundInRuntimeKeyStore += 1;
            if (inSession) {
              foundInSessionJsonAndRuntime += 1;
            } else {
              foundInRuntimeNotInSessionJson += 1;
            }
          }
        }
      }
    }
  }

  return {
    resolvedShape,
    unresolvedShape,
    resolvedSamples,
    unresolvedSamples,
    runtimeMappingAudit: {
      unresolvedChecked,
      foundInRuntimeKeyStore,
      notFoundInRuntimeKeyStore: unresolvedChecked - foundInRuntimeKeyStore,
      foundInRuntimeNotInSessionJson,
      foundInSessionJsonAndRuntime
    },
    sessionMappingAudit: auditSessionLidMapping(sessionJson)
  };
}

export function analyzeSpikeGroups(
  rawGroups: SpikeGroupInput[],
  sessionLidToPn: Map<string, string>,
  options: {
    runtimeLidToPn?: Map<string, string>;
    sessionJson?: string | null;
    includePhase2?: boolean;
  } = {}
): SpikeAggregateReport {
  const runtimeLidToPn = options.runtimeLidToPn ?? new Map();
  const groups = rawGroups.map(group =>
    buildSpikeGroupReport(group, sessionLidToPn, runtimeLidToPn)
  );
  return buildSpikeAggregateReport(
    groups,
    rawGroups,
    sessionLidToPn,
    runtimeLidToPn,
    options.sessionJson,
    options.includePhase2 !== false
  );
}

export function buildSpikeAggregateReport(
  groups: SpikeGroupReport[],
  rawGroups: SpikeGroupInput[] = [],
  sessionLidToPn: Map<string, string> = new Map(),
  runtimeLidToPn: Map<string, string> = new Map(),
  sessionJson: string | null | undefined = null,
  includePhase2 = true
): SpikeAggregateReport {
  const totals = {
    groupsAnalyzed: groups.length,
    totalParticipants: 0,
    withPhoneNumberField: 0,
    withPnId: 0,
    lidWithPnField: 0,
    lidResolvedByMapping: 0,
    lidResolvedByRuntimeKeyStore: 0,
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
    totals.lidResolvedByRuntimeKeyStore += group.lidResolvedByRuntimeKeyStore;
    totals.unresolvedLid += group.unresolvedLid;
    totals.invalidPhone += group.invalidPhone;

    const resolvedInGroup =
      group.withPhoneNumberField +
      group.withPnId +
      group.lidWithPnField +
      group.lidResolvedByMapping +
      group.lidResolvedByRuntimeKeyStore;

    const mode = normalizeAddressingMode(group.addressingMode);
    modeBuckets[mode].groups += 1;
    modeBuckets[mode].participants += group.totalParticipants;
    modeBuckets[mode].resolved += resolvedInGroup;
  }

  for (const rawGroup of rawGroups) {
    for (const participant of rawGroup.participants) {
      const result = resolveSpikeParticipant(participant, sessionLidToPn, {
        runtimeLidToPn
      });
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
    totals.lidResolvedByMapping +
    totals.lidResolvedByRuntimeKeyStore;

  const report: SpikeAggregateReport = {
    ...totals,
    uniqueResolvedPhones: totals.uniqueResolvedPhones,
    resolutionPercentage: pct(resolvedTotal, totals.totalParticipants),
    pctWithPhoneNumberField: pct(totals.withPhoneNumberField, totals.totalParticipants),
    pctWithPnId: pct(totals.withPnId, totals.totalParticipants),
    pctLidWithPnField: pct(totals.lidWithPnField, totals.totalParticipants),
    pctLidResolvedByMapping: pct(
      totals.lidResolvedByMapping,
      totals.totalParticipants
    ),
    pctLidResolvedByRuntimeKeyStore: pct(
      totals.lidResolvedByRuntimeKeyStore,
      totals.totalParticipants
    ),
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
        pctResolved: pct(
          modeBuckets.unknown.resolved,
          modeBuckets.unknown.participants
        )
      }
    },
    groups
  };

  if (includePhase2) {
    report.phase2 = buildPhase2Report(
      rawGroups,
      sessionLidToPn,
      runtimeLidToPn,
      sessionJson
    );
  }

  return report;
}

/** Converte PN JID retornado por getPNForLID em dígitos plausíveis. */
export function phoneDigitsFromRuntimePnJid(
  pnJid: string | null | undefined
): string | null {
  return extractPhoneFromPnJid(pnJid);
}

export function containsFullPhoneInJson(value: unknown): boolean {
  const text = JSON.stringify(value);
  return /\b\d{11,15}\b/.test(text);
}
