/**
 * Resolução de telefone de participantes a partir do metadata do grupo (V1).
 * Usa somente campos oficiais do XML/Baileys: phoneNumber e id PN.
 * Nunca trata dígitos de @lid como telefone.
 */

import { isPlausibleWhatsAppPhoneNumber } from "./normalizeWhatsAppJidToNumber";

export const GROUP_PARTICIPANT_PHONE_AVAILABLE = "available";
export const GROUP_PARTICIPANT_PHONE_UNAVAILABLE = "unavailable";

export type GroupParticipantPhoneStatus =
  | typeof GROUP_PARTICIPANT_PHONE_AVAILABLE
  | typeof GROUP_PARTICIPANT_PHONE_UNAVAILABLE;

export type GroupMetadataParticipantInput = {
  id?: string | null;
  phoneNumber?: string | null;
  lid?: string | null;
  name?: string | null;
  notify?: string | null;
  admin?: string | null;
  isAdmin?: boolean | null;
  isSuperAdmin?: boolean | null;
};

export type NormalizedGroupParticipant = {
  displayName: string;
  phone: string | null;
  status: GroupParticipantPhoneStatus;
  isAdmin: boolean;
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

function phoneFromPnJid(jid: string | null | undefined): string | null {
  if (!isPnJid(jid)) return null;
  const local = String(jid).split("@")[0].split(":")[0];
  const digits = digitsOnly(local);
  return isPlausibleWhatsAppPhoneNumber(digits) ? digits : null;
}

function phoneFromValue(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (isLidJid(raw)) return null;
  if (isPnJid(raw)) return phoneFromPnJid(raw);
  const digits = digitsOnly(raw);
  return isPlausibleWhatsAppPhoneNumber(digits) ? digits : null;
}

export function resolveParticipantPhoneFromMetadata(
  participant: GroupMetadataParticipantInput
): string | null {
  const fromField = phoneFromValue(participant.phoneNumber);
  if (fromField) return fromField;

  const fromId = phoneFromPnJid(participant.id);
  if (fromId) return fromId;

  return null;
}

export function resolveParticipantDisplayName(
  participant: GroupMetadataParticipantInput
): string {
  const notify = String(participant.notify ?? "").trim();
  if (notify) return notify;
  const name = String(participant.name ?? "").trim();
  if (name) return name;
  return "";
}

export function isGroupParticipantAdmin(
  participant: GroupMetadataParticipantInput
): boolean {
  return (
    participant.admin === "admin" ||
    participant.admin === "superadmin" ||
    participant.isAdmin === true ||
    participant.isSuperAdmin === true
  );
}

export function normalizeGroupParticipantFromMetadata(
  participant: GroupMetadataParticipantInput
): NormalizedGroupParticipant {
  const phone = resolveParticipantPhoneFromMetadata(participant);
  return {
    displayName: resolveParticipantDisplayName(participant),
    phone,
    status: phone
      ? GROUP_PARTICIPANT_PHONE_AVAILABLE
      : GROUP_PARTICIPANT_PHONE_UNAVAILABLE,
    isAdmin: isGroupParticipantAdmin(participant)
  };
}

export function normalizeGroupParticipantsFromMetadata(
  participants: GroupMetadataParticipantInput[] | undefined
): NormalizedGroupParticipant[] {
  if (!Array.isArray(participants)) return [];
  return participants.map(normalizeGroupParticipantFromMetadata);
}

export function uniqueResolvedPhones(
  participants: NormalizedGroupParticipant[]
): string[] {
  const seen = new Set<string>();
  for (const p of participants) {
    if (p.phone) seen.add(p.phone);
  }
  return Array.from(seen);
}

export function maskGroupJid(jid: string | null | undefined): string {
  const raw = String(jid ?? "").trim();
  if (!raw) return "—";
  const [userPart, domain = ""] = raw.split("@");
  const user = userPart.split(":")[0];
  if (user.length <= 4) return `****@${domain || "?"}`;
  return `${user.slice(0, 4)}****@${domain || "?"}`;
}

export function normalizeGroupJidOrThrow(groupId: string): string {
  const s = String(groupId || "").trim();
  if (!s) {
    throw new Error("ERR_GROUP_ID_REQUIRED");
  }
  if (s.includes("@g.us")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) {
    throw new Error("ERR_GROUP_INVALID_GROUP_ID");
  }
  return `${digits}@g.us`;
}
