import {
  NormalizedGroupParticipant,
  NormalizedGroupSummary
} from "./WhatsAppGroupsProvider";

export const ADMIN_PREVIEW_MAX = 5;

export function countNormalizedGroupAdmins(
  participants: Array<{ isAdmin?: boolean }> | undefined
): number {
  if (!participants?.length) return 0;
  return participants.filter(p => p.isAdmin === true).length;
}

/**
 * Preview de até 5 admins: displayName → local-part do JID → "Admin".
 * Mesma semântica do GroupController pré-12.2-E.
 */
export function buildGroupAdminPreview(
  participants: NormalizedGroupParticipant[] | undefined
): string[] {
  if (!participants?.length) return [];
  const admins = participants.filter(p => p.isAdmin === true);
  return admins.slice(0, ADMIN_PREVIEW_MAX).map(p => {
    const jid = String(p.jid || "");
    const short = jid.split("@")[0] || "";
    const label = String(p.displayName || short || "").trim();
    return (label || "Admin").slice(0, 48);
  });
}

export function toPublicGroupListEntry(summary: NormalizedGroupSummary): {
  id: string;
  name: string;
  participantCount: number;
  adminCount: number;
  adminPreview: string[];
} {
  return {
    id: summary.remoteJid,
    name: summary.subject,
    participantCount: summary.participantCount,
    adminCount: summary.adminCount,
    adminPreview: summary.adminPreview
  };
}
