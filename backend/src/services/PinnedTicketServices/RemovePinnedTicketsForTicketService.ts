import PinnedTicket from "../../models/PinnedTicket";

/** Remove fixações quando o ticket deixa de estar em atendimento ou é excluído. */
const RemovePinnedTicketsForTicketService = async (
  ticketId: number
): Promise<void> => {
  if (!ticketId) return;
  await PinnedTicket.destroy({ where: { ticketId } });
};

export default RemovePinnedTicketsForTicketService;
