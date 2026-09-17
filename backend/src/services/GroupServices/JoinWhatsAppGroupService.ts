import AppError from "../../errors/AppError";
import { getWhatsAppGroupsProviderForWhatsapp } from "../../modules/whatsapp/groups/resolveWhatsAppGroupsProvider";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";

export function normalizeInviteCode(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const m = s.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/i);
  if (m) return m[1];
  return s.replace(/^\/+/, "").split(/\s/)[0];
}

const JoinWhatsAppGroupService = async ({
  companyId,
  whatsappId,
  inviteCode
}: {
  companyId: number;
  whatsappId: number;
  inviteCode: string;
}): Promise<{ groupJid: string | null }> => {
  const code = normalizeInviteCode(String(inviteCode || ""));
  if (!code) {
    throw new AppError("ERR_GROUP_INVITE_CODE_REQUIRED", 400);
  }

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  const provider = await getWhatsAppGroupsProviderForWhatsapp(whatsapp);
  return provider.acceptInvite(code);
};

export default JoinWhatsAppGroupService;
