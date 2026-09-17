import Contact from "../../models/Contact";
import {
  assertCanManageGroupParticipants,
  assertGroupParticipantsVisibility,
  GroupAccessActor
} from "../../helpers/groupVisibility";
import {
  maskGroupJid,
  normalizeGroupJidOrThrow,
  normalizeGroupParticipantsFromMetadata,
  uniqueResolvedPhones,
  type NormalizedGroupParticipant
} from "../../helpers/groupParticipantFromMetadata";
import {
  buildExistingPhonesLookupWhere,
  wrapGroupAccessError
} from "../../helpers/groupParticipantsRequest";
import { toMetadataParticipantInput } from "../../modules/whatsapp/groups/mapGroupMetadataParticipants";
import { getWhatsAppGroupsProviderForWhatsapp } from "../../modules/whatsapp/groups/resolveWhatsAppGroupsProvider";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";

export type GroupParticipantsSnapshot = {
  whatsappId: number;
  companyId: number;
  groupJid: string;
  groupJidMasked: string;
  groupSubject: string;
  participants: NormalizedGroupParticipant[];
  existingPhones: Set<string>;
};

const GroupLoadParticipantsSnapshotService = async ({
  companyId,
  whatsappId,
  groupJid,
  actor
}: {
  companyId: number;
  whatsappId: number;
  groupJid: string;
  actor: GroupAccessActor;
}): Promise<GroupParticipantsSnapshot> => {
  assertCanManageGroupParticipants(actor);
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  let jid: string;
  try {
    jid = normalizeGroupJidOrThrow(groupJid);
  } catch (err) {
    wrapGroupAccessError(err);
  }

  const digits = jid.replace(/\D/g, "");
  const groupContact = await Contact.findOne({
    where: { companyId, isGroup: true, number: digits }
  });
  await assertGroupParticipantsVisibility(actor, groupContact);

  const provider = await getWhatsAppGroupsProviderForWhatsapp(whatsapp);
  let meta: {
    subject: string;
    participants: ReturnType<typeof toMetadataParticipantInput>[];
  };
  try {
    const normalized = await provider.getGroupMetadata(jid);
    meta = {
      subject: normalized.subject,
      participants: normalized.participants.map(toMetadataParticipantInput)
    };
  } catch (err) {
    wrapGroupAccessError(err);
  }

  const participants = normalizeGroupParticipantsFromMetadata(
    (meta?.participants || []) as never
  );
  const phones = uniqueResolvedPhones(participants);
  const existingPhones = new Set<string>();

  if (phones.length > 0) {
    const rows = await Contact.findAll({
      where: buildExistingPhonesLookupWhere(companyId, phones),
      attributes: ["number"]
    });
    rows.forEach(row => {
      if (row.number) existingPhones.add(String(row.number));
    });
  }

  return {
    whatsappId: Number(whatsappId),
    companyId,
    groupJid: jid,
    groupJidMasked: maskGroupJid(jid),
    groupSubject: String(meta?.subject || "").trim(),
    participants,
    existingPhones
  };
};

export default GroupLoadParticipantsSnapshotService;
