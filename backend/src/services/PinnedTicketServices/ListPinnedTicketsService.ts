import PinnedTicket from "../../models/PinnedTicket";

interface Request {
  userId: number;
  companyId: number;
}

export interface PinnedTicketListItem {
  ticketId: number;
  createdAt: Date;
}

const ListPinnedTicketsService = async ({
  userId,
  companyId
}: Request): Promise<PinnedTicketListItem[]> => {
  const rows = await PinnedTicket.findAll({
    where: { userId, companyId },
    attributes: ["ticketId", "createdAt"],
    order: [["createdAt", "ASC"]]
  });

  return rows.map((row) => ({
    ticketId: row.ticketId,
    createdAt: row.createdAt
  }));
};

export default ListPinnedTicketsService;
