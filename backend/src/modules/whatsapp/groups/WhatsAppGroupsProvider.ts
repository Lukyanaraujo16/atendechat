/**
 * Contrato de gestão de grupos WhatsApp independente de WASocket.
 * 12.2-E: BaileysGroupsProvider. 12.2-F: EvolutionGroupsProvider.
 */

export type WhatsAppGroupsProviderKind = "baileys" | "evolution";

export type NormalizedGroupParticipant = {
  jid: string;
  phoneNumber?: string | null;
  lid?: string | null;
  isAdmin: boolean;
  displayName?: string;
};

export type NormalizedGroupSummary = {
  remoteJid: string;
  subject: string;
  participantCount: number;
  adminCount: number;
  adminPreview: string[];
};

export type NormalizedGroupMetadata = {
  remoteJid: string;
  subject: string;
  participants: NormalizedGroupParticipant[];
};

export type NormalizedCreateGroupResult = {
  remoteJid: string;
  subject: string;
  participantCount: number;
};

export type CreateWhatsAppGroupInput = {
  subject: string;
  participantJids: string[];
};

export interface WhatsAppGroupsProvider {
  readonly provider: WhatsAppGroupsProviderKind;

  listParticipatingGroups(): Promise<NormalizedGroupSummary[]>;

  getGroupMetadata(groupJid: string): Promise<NormalizedGroupMetadata>;

  getGroupProfilePicture?(groupJid: string): Promise<string | null>;

  createGroup(
    input: CreateWhatsAppGroupInput
  ): Promise<NormalizedCreateGroupResult>;

  acceptInvite(code: string): Promise<{ groupJid: string | null }>;

  leaveGroup(groupJid: string): Promise<void>;
}
