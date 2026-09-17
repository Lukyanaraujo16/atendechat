import { Boom } from "@hapi/boom";
import type { WASocket } from "@whiskeysockets/baileys";
import AppError from "../../../../../errors/AppError";
import { getWbot } from "../../../../../libs/wbot";
import {
  buildGroupAdminPreview,
  countNormalizedGroupAdmins
} from "../../../groups/groupAdminPreview";
import { mapGroupMetadataParticipants } from "../../../groups/mapGroupMetadataParticipants";
import {
  CreateWhatsAppGroupInput,
  NormalizedCreateGroupResult,
  NormalizedGroupMetadata,
  NormalizedGroupSummary,
  WhatsAppGroupsProvider
} from "../../../groups/WhatsAppGroupsProvider";

type Session = WASocket & { id?: number };

function toAppError(err: unknown): never {
  if (err instanceof AppError) throw err;
  if (err instanceof Boom) {
    throw new AppError("ERR_GROUP_ACCESS_DENIED", 400, err.message);
  }
  throw err;
}

function mapSummary(
  jid: string,
  meta: { subject?: string; participants?: unknown[]; size?: number }
): NormalizedGroupSummary {
  const participants = mapGroupMetadataParticipants(
    (meta?.participants || []) as never
  );
  const participantCount = Array.isArray(meta?.participants)
    ? meta.participants.length
    : meta?.size ?? 0;
  return {
    remoteJid: jid,
    subject: String(meta?.subject || ""),
    participantCount,
    adminCount: countNormalizedGroupAdmins(participants),
    adminPreview: buildGroupAdminPreview(participants)
  };
}

export class BaileysGroupsProvider implements WhatsAppGroupsProvider {
  readonly provider = "baileys" as const;

  private readonly wbot: Session;

  constructor(wbot: Session) {
    this.wbot = wbot;
  }

  static fromWhatsappId(whatsappId: number): BaileysGroupsProvider {
    const wbot = getWbot(whatsappId);
    return new BaileysGroupsProvider(wbot);
  }

  async listParticipatingGroups(): Promise<NormalizedGroupSummary[]> {
    try {
      const data = await this.wbot.groupFetchAllParticipating();
      return Object.entries(data || {}).map(([jid, meta]) =>
        mapSummary(
          jid,
          meta as { subject?: string; participants?: unknown[]; size?: number }
        )
      );
    } catch (err) {
      return toAppError(err);
    }
  }

  async getGroupMetadata(groupJid: string): Promise<NormalizedGroupMetadata> {
    try {
      const meta = await this.wbot.groupMetadata(groupJid);
      const participants = mapGroupMetadataParticipants(
        (meta?.participants || []) as never
      );
      return {
        remoteJid: String(meta?.id || groupJid),
        subject: String(meta?.subject || "").trim(),
        participants
      };
    } catch (err) {
      return toAppError(err);
    }
  }

  async getGroupProfilePicture(groupJid: string): Promise<string | null> {
    try {
      const url = await this.wbot.profilePictureUrl(groupJid);
      return url ? String(url) : null;
    } catch {
      return null;
    }
  }

  async createGroup(
    input: CreateWhatsAppGroupInput
  ): Promise<NormalizedCreateGroupResult> {
    try {
      const meta = await this.wbot.groupCreate(
        input.subject,
        input.participantJids
      );
      return {
        remoteJid: String(meta.id || ""),
        subject: String(meta.subject || input.subject),
        participantCount: Array.isArray(meta.participants)
          ? meta.participants.length
          : 0
      };
    } catch (err) {
      return toAppError(err);
    }
  }

  async acceptInvite(code: string): Promise<{ groupJid: string | null }> {
    try {
      const groupJid = await this.wbot.groupAcceptInvite(code);
      return { groupJid: groupJid != null ? String(groupJid) : null };
    } catch (err) {
      return toAppError(err);
    }
  }

  async leaveGroup(groupJid: string): Promise<void> {
    try {
      await this.wbot.groupLeave(groupJid);
    } catch (err) {
      toAppError(err);
    }
  }
}
