import ShowTicketService from "./ShowTicketService";
import UpdateTicketService from "./UpdateTicketService";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";

interface Request {
  companyId: number;
  ticketIds: number[];
  whatsappId: number;
  actionUserId?: string | null;
}

interface Response {
  updated: number;
}

const BulkAssignTicketsWhatsappService = async ({
  companyId,
  ticketIds,
  whatsappId,
  actionUserId = null
}: Request): Promise<Response> => {
  await ShowWhatsAppService(String(whatsappId), companyId);

  let updated = 0;

  for (const ticketId of ticketIds) {
    try {
      await ShowTicketService(ticketId, companyId);
      await UpdateTicketService({
        ticketId: String(ticketId),
        companyId,
        actionUserId,
        ticketData: { whatsappId: String(whatsappId) }
      });
      updated += 1;
    } catch (err) {
      // skip ticket on error (e.g. not found)
    }
  }

  return { updated };
};

export default BulkAssignTicketsWhatsappService;
