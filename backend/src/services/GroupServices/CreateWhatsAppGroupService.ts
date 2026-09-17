import AppError from "../../errors/AppError";
import { getWhatsAppGroupsProviderForWhatsapp } from "../../modules/whatsapp/groups/resolveWhatsAppGroupsProvider";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";

function normalizeDigitsToJid(input: string): string {
  const d = String(input).replace(/\D/g, "");
  if (!d) {
    throw new AppError("ERR_GROUP_INVALID_NUMBER", 400);
  }
  return `${d}@s.whatsapp.net`;
}

const CreateWhatsAppGroupService = async ({
  companyId,
  whatsappId,
  name,
  participants
}: {
  companyId: number;
  whatsappId: number;
  name: string;
  participants: string[];
}): Promise<{ id: string; name: string; participantCount: number }> => {
  if (!name?.trim()) {
    throw new AppError("ERR_GROUP_CREATE_PARAMS", 400);
  }
  if (!Array.isArray(participants) || participants.length < 1) {
    throw new AppError("ERR_GROUP_CREATE_PARTICIPANTS", 400);
  }

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  const provider = await getWhatsAppGroupsProviderForWhatsapp(whatsapp);
  const jids = participants.map(p => normalizeDigitsToJid(String(p)));
  const created = await provider.createGroup({
    subject: name.trim(),
    participantJids: jids
  });

  return {
    id: created.remoteJid,
    name: created.subject,
    participantCount: created.participantCount
  };
};

export default CreateWhatsAppGroupService;
