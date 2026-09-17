import {
  isGroupParticipantAdmin,
  resolveParticipantDisplayName,
  resolveParticipantPhoneFromMetadata,
  type GroupMetadataParticipantInput
} from "../../../helpers/groupParticipantFromMetadata";
import { NormalizedGroupParticipant } from "./WhatsAppGroupsProvider";

function isLidJid(jid: string): boolean {
  const raw = jid.trim().toLowerCase();
  return raw.endsWith("@lid") || raw.endsWith("@hosted.lid");
}

/**
 * Mapeia participante de metadata (Baileys/XML) → tipo provider.
 * Telefone só via helpers existentes — nunca strip de @lid.
 */
export function mapGroupMetadataParticipant(
  raw: GroupMetadataParticipantInput
): NormalizedGroupParticipant {
  const jid = String(raw.id || "").trim();
  const phoneDigits = resolveParticipantPhoneFromMetadata(raw);
  const lidFromField =
    raw.lid != null && String(raw.lid).trim() ? String(raw.lid).trim() : null;

  return {
    jid,
    phoneNumber: phoneDigits,
    lid: isLidJid(jid) ? jid : lidFromField,
    isAdmin: isGroupParticipantAdmin(raw),
    displayName: resolveParticipantDisplayName(raw) || undefined
  };
}

export function mapGroupMetadataParticipants(
  participants: GroupMetadataParticipantInput[] | undefined
): NormalizedGroupParticipant[] {
  if (!Array.isArray(participants)) return [];
  return participants.map(mapGroupMetadataParticipant);
}

export function toMetadataParticipantInput(
  participant: NormalizedGroupParticipant
): GroupMetadataParticipantInput {
  return {
    id: participant.jid,
    phoneNumber: participant.phoneNumber,
    lid: participant.lid,
    notify: participant.displayName || null,
    name: participant.displayName || null,
    isAdmin: participant.isAdmin
  };
}
