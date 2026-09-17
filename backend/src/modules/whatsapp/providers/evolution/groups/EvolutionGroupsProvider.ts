import AppError from "../../../../../errors/AppError";
import { resolveParticipantPhoneFromMetadata } from "../../../../../helpers/groupParticipantFromMetadata";
import {
  EvolutionHttpError,
  evolutionAcceptGroupInvite,
  evolutionCreateGroup,
  evolutionFetchAllGroups,
  evolutionFindGroupInfos,
  evolutionLeaveGroup
} from "../inbound/evolutionHttpClient";
import {
  CreateWhatsAppGroupInput,
  NormalizedCreateGroupResult,
  NormalizedGroupMetadata,
  NormalizedGroupSummary,
  WhatsAppGroupsProvider
} from "../../../groups/WhatsAppGroupsProvider";
import {
  EvolutionGroup,
  evolutionPictureUrl,
  mapEvolutionCreateGroupResult,
  mapEvolutionGroupMetadata,
  mapEvolutionGroupSummary
} from "./mapEvolutionGroup";

function toGroupAppError(err: unknown): never {
  if (err instanceof AppError) throw err;
  if (err instanceof EvolutionHttpError) {
    if (
      err.code === "ERR_EVOLUTION_CREDENTIAL_MISSING" ||
      err.code === "ERR_EVOLUTION_CREDENTIAL_DECRYPT"
    ) {
      throw new AppError(err.code, 400, err.message);
    }
    if (err.code === "ERR_EVOLUTION_TIMEOUT") {
      throw new AppError(err.code, 504, err.message);
    }
    throw new AppError("ERR_GROUP_ACCESS_DENIED", 400);
  }
  throw err;
}

function asEvolutionGroup(data: unknown): EvolutionGroup {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return {};
  }
  return data as EvolutionGroup;
}

function asEvolutionGroupList(data: unknown): EvolutionGroup[] {
  if (!Array.isArray(data)) {
    throw new AppError("ERR_GROUP_ACCESS_DENIED", 400);
  }
  return data as EvolutionGroup[];
}

/**
 * Converte JID PN da boundary para dígitos exigidos pelo schema Evolution 2.3.7.
 * Recusa @lid e @g.us — nunca strip de LID.
 */
export function evolutionParticipantJidToDigits(jid: string): string {
  const raw = String(jid || "").trim();
  const lower = raw.toLowerCase();
  if (
    lower.endsWith("@lid") ||
    lower.endsWith("@hosted.lid") ||
    lower.includes("@g.us")
  ) {
    throw new AppError("ERR_GROUP_INVALID_NUMBER", 400);
  }
  if (!lower.endsWith("@s.whatsapp.net") && !lower.endsWith("@hosted")) {
    throw new AppError("ERR_GROUP_INVALID_NUMBER", 400);
  }
  const digits = resolveParticipantPhoneFromMetadata({ id: raw });
  if (!digits) {
    throw new AppError("ERR_GROUP_INVALID_NUMBER", 400);
  }
  return digits;
}

export class EvolutionGroupsProvider implements WhatsAppGroupsProvider {
  readonly provider = "evolution" as const;

  private readonly whatsappId: number;

  constructor(whatsappId: number) {
    this.whatsappId = whatsappId;
  }

  static fromWhatsapp(whatsapp: { id: number }): EvolutionGroupsProvider {
    return new EvolutionGroupsProvider(whatsapp.id);
  }

  async listParticipatingGroups(): Promise<NormalizedGroupSummary[]> {
    try {
      const data = await evolutionFetchAllGroups({
        whatsappId: this.whatsappId,
        getParticipants: true
      });
      return asEvolutionGroupList(data).map(mapEvolutionGroupSummary);
    } catch (err) {
      return toGroupAppError(err);
    }
  }

  async getGroupMetadata(groupJid: string): Promise<NormalizedGroupMetadata> {
    try {
      const data = await evolutionFindGroupInfos({
        whatsappId: this.whatsappId,
        groupJid
      });
      return mapEvolutionGroupMetadata(asEvolutionGroup(data), groupJid);
    } catch (err) {
      return toGroupAppError(err);
    }
  }

  async getGroupProfilePicture(groupJid: string): Promise<string | null> {
    try {
      const data = await evolutionFindGroupInfos({
        whatsappId: this.whatsappId,
        groupJid
      });
      return evolutionPictureUrl(asEvolutionGroup(data));
    } catch {
      return null;
    }
  }

  async createGroup(
    input: CreateWhatsAppGroupInput
  ): Promise<NormalizedCreateGroupResult> {
    const participants = input.participantJids.map(
      evolutionParticipantJidToDigits
    );
    try {
      const data = await evolutionCreateGroup({
        whatsappId: this.whatsappId,
        subject: input.subject,
        participants
      });
      return mapEvolutionCreateGroupResult(
        asEvolutionGroup(data),
        input.subject
      );
    } catch (err) {
      return toGroupAppError(err);
    }
  }

  async acceptInvite(code: string): Promise<{ groupJid: string | null }> {
    try {
      const data = await evolutionAcceptGroupInvite({
        whatsappId: this.whatsappId,
        inviteCode: code
      });
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { groupJid: null };
      }
      const { groupJid } = data as { groupJid?: unknown };
      if (groupJid == null || String(groupJid).trim() === "") {
        return { groupJid: null };
      }
      return { groupJid: String(groupJid) };
    } catch (err) {
      return toGroupAppError(err);
    }
  }

  async leaveGroup(groupJid: string): Promise<void> {
    try {
      await evolutionLeaveGroup({
        whatsappId: this.whatsappId,
        groupJid
      });
    } catch (err) {
      toGroupAppError(err);
    }
  }
}
