import { Transaction } from "sequelize";
import sequelize from "../../database";
import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import TicketTag from "../../models/TicketTag";
import TicketTraking from "../../models/TicketTraking";
import FlowExecutionLog from "../../models/FlowExecutionLog";
import OpenAiUsage from "../../models/OpenAiUsage";
import UserRating from "../../models/UserRating";
import TicketNote from "../../models/TicketNote";
import PinnedTicket from "../../models/PinnedTicket";
import CrmDeal from "../../models/CrmDeal";
import { logger } from "../../utils/logger";
import { registerTicketDeletionGuard } from "./TicketDeletionGuardService";

async function destroyTicketDependents(
  ticketId: number,
  transaction: Transaction
): Promise<void> {
  await Message.destroy({ where: { ticketId }, transaction });
  await TicketTag.destroy({ where: { ticketId }, transaction });
  await TicketTraking.destroy({ where: { ticketId }, transaction });
  await FlowExecutionLog.destroy({
    where: { ticket_id: ticketId },
    transaction
  });
  await OpenAiUsage.destroy({ where: { ticketId }, transaction });
  await UserRating.destroy({ where: { ticketId }, transaction });
  await TicketNote.destroy({ where: { ticketId }, transaction });
  await PinnedTicket.destroy({ where: { ticketId }, transaction });
  await CrmDeal.update(
    { ticketId: null },
    { where: { ticketId }, transaction }
  );
}

const DeleteTicketService = async (
  id: string,
  companyId: number,
  deletedBy?: number | null
): Promise<Ticket> => {
  const ticket = await Ticket.findOne({
    where: { id, companyId }
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  const ticketIdNum = ticket.id;
  const snapshot = { ...ticket.get({ plain: true }) } as Ticket;

  await sequelize.transaction(async (transaction: Transaction) => {
    await destroyTicketDependents(ticketIdNum, transaction);
    try {
      await registerTicketDeletionGuard(ticket, deletedBy, transaction);
    } catch (guardErr) {
      logger.error(
        {
          err: guardErr,
          ticketId: ticketIdNum,
          companyId,
          contactId: ticket.contactId,
          whatsappId: ticket.whatsappId ?? null,
          queueId: ticket.queueId ?? null
        },
        "[TicketDeletionGuard] register failed — continuing ticket delete"
      );
    }
    await Ticket.destroy({
      where: { id: ticketIdNum, companyId },
      transaction
    });
  });

  const stillExists = await Ticket.findByPk(ticketIdNum);
  if (stillExists) {
    logger.error(
      { ticketId: ticketIdNum, companyId },
      "[TicketDelete] after_delete_find ticket still exists"
    );
  } else {
    logger.info(
      { ticketId: ticketIdNum, companyId },
      "[TicketDelete] after_delete_find confirmed removed"
    );
  }

  logger.info(
    {
      ticketId: ticketIdNum,
      companyId,
      contactId: ticket.contactId,
      whatsappId: ticket.whatsappId,
      status: ticket.status,
      deletedBy: deletedBy ?? null
    },
    "[TicketDelete] ticket destroyed with dependents and deletion guard"
  );

  return snapshot;
};

export default DeleteTicketService;
