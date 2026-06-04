import AppError from "../../errors/AppError";
import { getWbot } from "../../libs/wbot";
import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { ensureGroupContactDisplayName } from "../../helpers/groupContactName";

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

interface OpenGroupConversationParams {
  companyId: number;
  whatsappId: number;
  groupId: string;
}

/**
 * Garante contato de grupo + ticket na inbox (grupos), sem chatbot/Flow.
 * Usa FindOrCreateTicketService com groupContact (mesmo fluxo do listener).
 */
const GroupOpenConversationService = async ({
  companyId,
  whatsappId,
  groupId
}: OpenGroupConversationParams): Promise<{ uuid: string }> => {
  const jid = normalizeGroupJid(groupId);
  const digits = jid.replace(/\D/g, "");

  await ShowWhatsAppService(whatsappId, companyId);
  const wbot = getWbot(whatsappId);

  const whatsappRow = await Whatsapp.findByPk(whatsappId, {
    attributes: ["id", "companyId", "defaultGroupVisible"]
  });

  let groupContact = await Contact.findOne({
    where: { companyId, isGroup: true, number: digits }
  });

  if (!groupContact) {
    let profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
    try {
      profilePicUrl = await wbot.profilePictureUrl(jid);
    } catch {
      // mantém placeholder
    }

    let subject = digits;
    try {
      const meta = await wbot.groupMetadata(jid);
      if (meta?.subject) subject = meta.subject;
    } catch {
      throw new AppError(
        "Não foi possível acessar o grupo (sessão sem acesso ou grupo inexistente).",
        400
      );
    }

    groupContact = await CreateOrUpdateContactService({
      name: subject,
      number: digits,
      isGroup: true,
      groupVisible: Boolean((whatsappRow as any)?.defaultGroupVisible),
      companyId,
      whatsappId,
      profilePicUrl
    });
  } else {
    await ensureGroupContactDisplayName(groupContact, { wbot, whatsappId });
  }

  const ticket = await FindOrCreateTicketService(
    groupContact,
    whatsappId,
    0,
    companyId,
    groupContact,
    { forceCreate: true, messageReceivedAt: new Date() }
  );

  return { uuid: ticket.uuid };
};

export default GroupOpenConversationService;
