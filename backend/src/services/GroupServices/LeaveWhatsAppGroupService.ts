import AppError from "../../errors/AppError";
import { getWhatsAppGroupsProviderForWhatsapp } from "../../modules/whatsapp/groups/resolveWhatsAppGroupsProvider";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";

function normalizeGroupJid(groupId: string): string {
  const s = String(groupId || "").trim();
  if (!s) {
    throw new AppError("ERR_GROUP_ID_REQUIRED", 400);
  }
  if (s.includes("@g.us")) return s;
  const digits = s.replace(/\D/g, "");
  if (!digits) {
    throw new AppError("ERR_GROUP_INVALID_GROUP_ID", 400);
  }
  return `${digits}@g.us`;
}

const LeaveWhatsAppGroupService = async ({
  companyId,
  whatsappId,
  groupId
}: {
  companyId: number;
  whatsappId: number;
  groupId: string;
}): Promise<{ ok: true }> => {
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  const jid = normalizeGroupJid(String(groupId));
  const provider = await getWhatsAppGroupsProviderForWhatsapp(whatsapp);
  await provider.leaveGroup(jid);
  return { ok: true };
};

export default LeaveWhatsAppGroupService;
