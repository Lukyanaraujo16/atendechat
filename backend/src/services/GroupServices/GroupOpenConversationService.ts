import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import {
  createFetchRemoteSubjectFromProvider,
  ensureGroupContactDisplayName
} from "../../helpers/groupContactName";
import { ensureGroupTicketPermanentOpen } from "../../helpers/groupTicketRules";
import { getWhatsAppGroupsProviderForWhatsapp } from "../../modules/whatsapp/groups/resolveWhatsAppGroupsProvider";
import { ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY } from "../../modules/whatsapp/groups/groupsErrors";

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

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);
  const provider = await getWhatsAppGroupsProviderForWhatsapp(whatsapp);

  let groupContact = await Contact.findOne({
    where: { companyId, isGroup: true, number: digits }
  });

  if (!groupContact) {
    let profilePicUrl = `${process.env.FRONTEND_URL}/nopicture.png`;
    if (provider.getGroupProfilePicture) {
      const url = await provider.getGroupProfilePicture(jid);
      if (url) profilePicUrl = url;
    }

    let subject = digits;
    try {
      const meta = await provider.getGroupMetadata(jid);
      if (meta?.subject) subject = meta.subject;
    } catch (err) {
      if (
        err instanceof AppError &&
        err.message === ERR_WHATSAPP_GROUPS_PROVIDER_NOT_READY
      ) {
        throw err;
      }
      throw new AppError(
        "Não foi possível acessar o grupo (sessão sem acesso ou grupo inexistente).",
        400
      );
    }

    groupContact = await CreateOrUpdateContactService({
      name: subject,
      number: digits,
      isGroup: true,
      groupVisible: Boolean(
        (whatsapp as { defaultGroupVisible?: boolean }).defaultGroupVisible
      ),
      companyId,
      whatsappId,
      profilePicUrl
    });
  } else {
    await ensureGroupContactDisplayName(groupContact, {
      fetchRemoteSubject: createFetchRemoteSubjectFromProvider(provider)
    });
  }

  let ticket = await FindOrCreateTicketService(
    groupContact,
    whatsappId,
    0,
    companyId,
    groupContact,
    { forceCreate: true, messageReceivedAt: new Date() }
  );

  ticket = await ensureGroupTicketPermanentOpen(ticket);

  return { uuid: ticket.uuid };
};

export default GroupOpenConversationService;
