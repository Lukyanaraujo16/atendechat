import { mapGroupMetadataParticipant } from "../../../groups/mapGroupMetadataParticipants";
import {
  buildGroupAdminPreview,
  countNormalizedGroupAdmins
} from "../../../groups/groupAdminPreview";
import {
  NormalizedCreateGroupResult,
  NormalizedGroupMetadata,
  NormalizedGroupParticipant,
  NormalizedGroupSummary
} from "../../../groups/WhatsAppGroupsProvider";
import type { GroupMetadataParticipantInput } from "../../../../../helpers/groupParticipantFromMetadata";

/** Shape mínimo da Pilot 2.3.7. Campos extras são ignorados. */
export type EvolutionGroupParticipant = {
  id?: string;
  phoneNumber?: string | null;
  admin?: "admin" | "superadmin" | string | null;
  notify?: string | null;
  name?: string | null;
  pushName?: string | null;
};

export type EvolutionGroup = {
  id?: string;
  subject?: string;
  pictureUrl?: string | null;
  size?: number;
  participants?: EvolutionGroupParticipant[];
};

function toMetadataInput(
  raw: EvolutionGroupParticipant
): GroupMetadataParticipantInput {
  const display = String(raw.name || raw.pushName || "").trim();
  return {
    id: raw.id,
    phoneNumber: raw.phoneNumber,
    admin: raw.admin,
    notify: raw.notify,
    name: display || null
  };
}

export function mapEvolutionGroupParticipants(
  participants: EvolutionGroupParticipant[] | undefined
): NormalizedGroupParticipant[] {
  if (!Array.isArray(participants)) return [];
  return participants
    .filter(p => String(p?.id || "").trim())
    .map(p => mapGroupMetadataParticipant(toMetadataInput(p)));
}

export function participantCountFromEvolutionGroup(
  group: EvolutionGroup,
  participants: NormalizedGroupParticipant[]
): number {
  const size = Number(group.size);
  if (Number.isFinite(size) && size >= 0) return size;
  return participants.length;
}

export function mapEvolutionGroupSummary(
  group: EvolutionGroup
): NormalizedGroupSummary {
  const participants = mapEvolutionGroupParticipants(group.participants);
  return {
    remoteJid: String(group.id || ""),
    subject: String(group.subject || ""),
    participantCount: participantCountFromEvolutionGroup(group, participants),
    adminCount: countNormalizedGroupAdmins(participants),
    adminPreview: buildGroupAdminPreview(participants)
  };
}

export function mapEvolutionGroupMetadata(
  group: EvolutionGroup,
  fallbackJid: string
): NormalizedGroupMetadata {
  return {
    remoteJid: String(group.id || fallbackJid),
    subject: String(group.subject || "").trim(),
    participants: mapEvolutionGroupParticipants(group.participants)
  };
}

export function mapEvolutionCreateGroupResult(
  group: EvolutionGroup,
  fallbackSubject: string
): NormalizedCreateGroupResult {
  const participants = mapEvolutionGroupParticipants(group.participants);
  return {
    remoteJid: String(group.id || ""),
    subject: String(group.subject || fallbackSubject),
    participantCount: participantCountFromEvolutionGroup(group, participants)
  };
}

export function evolutionPictureUrl(group: EvolutionGroup): string | null {
  const url = group.pictureUrl;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return trimmed || null;
}
