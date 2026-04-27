import { Op } from "sequelize";
import { getIO } from "../../libs/socket";
import { toCompanyTicketAudience } from "../../helpers/companyTicketSocket";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import TicketTraking from "../../models/TicketTraking";
import ShowTicketService from "./ShowTicketService";
import { logger } from "../../utils/logger";

const CONNECTED = "CONNECTED";

function ticketIsOrphan(ticket: Ticket, linkedWhatsapp: Whatsapp | null): boolean {
  if (ticket.whatsappId == null) return true;
  return linkedWhatsapp == null;
}

interface Request {
  ticketId: number;
  companyId: number;
  newWhatsappId: number;
  actionUserId?: string | number | null;
}

const ReassignOrphanTicketWhatsappService = async ({
  ticketId,
  companyId,
  newWhatsappId,
  actionUserId = null
}: Request): Promise<Ticket> => {
  if (newWhatsappId == null || Number.isNaN(Number(newWhatsappId))) {
    throw new AppError("ERR_INVALID_BODY", 400);
  }

  const ticket = await Ticket.findByPk(ticketId);
  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }
  if (ticket.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const linkedWhatsapp =
    ticket.whatsappId != null
      ? await Whatsapp.findOne({
          where: { id: ticket.whatsappId, companyId }
        })
      : null;

  if (!ticketIsOrphan(ticket, linkedWhatsapp)) {
    throw new AppError(
      "ERR_TICKET_NOT_ORPHAN",
      400,
      "Só é possível reatribuir conexão em atendimentos sem vínculo ativo com o WhatsApp."
    );
  }

  const target = await Whatsapp.findOne({
    where: { id: newWhatsappId, companyId }
  });
  if (!target) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }
  if (target.status !== CONNECTED) {
    throw new AppError(
      "ERR_WAPP_NOT_CONNECTED",
      400,
      "Escolha uma conexão com status conectado."
    );
  }

  const oldWhatsappId = ticket.whatsappId;

  await ticket.update({ whatsappId: newWhatsappId });

  const traking = await TicketTraking.findOne({
    where: {
      ticketId,
      finishedAt: { [Op.is]: null }
    }
  });
  if (traking) {
    await traking.update({ whatsappId: newWhatsappId });
  }

  logger.info(
    `[TicketOrphan] reassign whatsapp ticketId=${ticket.id} oldWhatsappId=${oldWhatsappId ?? "null"} newWhatsappId=${newWhatsappId} companyId=${companyId} userId=${actionUserId ?? "null"}`
  );

  const ticketForEmit = await ShowTicketService(ticketId, companyId);
  const io = getIO();

  toCompanyTicketAudience(io, companyId, {
    id: ticketForEmit.id,
    status: ticketForEmit.status,
    queueId: ticketForEmit.queueId,
    userId: ticketForEmit.userId
  }).emit(`company-${companyId}-ticket`, {
    action: "update",
    ticket: ticketForEmit
  });

  return ticketForEmit;
};

export default ReassignOrphanTicketWhatsappService;
