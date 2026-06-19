import { Op } from "sequelize";
import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";
import { logger } from "../utils/logger";

/**
 * Impede abrir/criar atendimento quando o contato já tem OUTRO ticket open/pending.
 * `excludeTicketId` ignora o ticket em atualização (ex.: pending → open no aceite).
 */
const CheckContactOpenTickets = async (
  contactId: number,
  whatsappId?: string,
  excludeTicketId?: number
): Promise<void> => {
  const where: Record<string, unknown> = {
    contactId,
    status: { [Op.or]: ["open", "pending"] }
  };

  if (excludeTicketId != null && !Number.isNaN(Number(excludeTicketId))) {
    where.id = { [Op.ne]: excludeTicketId };
  }

  if (whatsappId != null && `${whatsappId}` !== "") {
    where.whatsappId = whatsappId;
  }

  const otherOpenTicket = await Ticket.findOne({ where });

  if (otherOpenTicket) {
    logger.warn(
      {
        contactId,
        whatsappId: whatsappId ?? null,
        excludeTicketId: excludeTicketId ?? null,
        existingTicketId: otherOpenTicket.id,
        existingTicketStatus: otherOpenTicket.status
      },
      "[CheckContactOpenTickets] ERR_OTHER_OPEN_TICKET"
    );
    throw new AppError("ERR_OTHER_OPEN_TICKET");
  }
};

export default CheckContactOpenTickets;
