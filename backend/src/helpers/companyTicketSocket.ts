import { Server as SocketIO } from "socket.io";

/** Campos usados para montar salas alinhadas a `libs/socket.ts` (joinTickets / joinNotification). */
export type CompanyTicketRoomTarget = {
  id: number;
  status: string;
  queueId: number | null;
  userId?: number | null;
};

/**
 * Destinatários para eventos `company-{companyId}-ticket` com action update (ou payload equivalente).
 * Inclui mainchannel (todos os utilizadores autenticados da empresa), salas por estado/fila e sala do ticket (chat aberto).
 */
export function toCompanyTicketAudience(
  io: SocketIO,
  companyId: number,
  ticket: CompanyTicketRoomTarget
) {
  let op = io
    .to(String(ticket.id))
    .to(`company-${companyId}-${ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`company-${companyId}-mainchannel`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-notification`);

  const uid = ticket.userId;
  if (uid != null && uid !== undefined && !Number.isNaN(Number(uid))) {
    op = op.to(`user-${uid}`);
  }
  return op;
}

/** Destinatários para action delete (remover ticket das listas). */
export function toCompanyTicketDeleteAudience(
  io: SocketIO,
  companyId: number,
  ticket: CompanyTicketRoomTarget
) {
  return io
    .to(String(ticket.id))
    .to(`company-${companyId}-${ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`company-${companyId}-mainchannel`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-notification`);
}
