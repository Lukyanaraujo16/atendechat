import { Request, Response } from "express";
import Ticket from "../models/Ticket";
import { listFlowExecutionLogsByTicket } from "../services/FlowBuilderService/FlowExecutionLogService";
import {
  assertUserCanAccessTicketResource,
  toTicketAccessPayload
} from "../helpers/ticketAccess";
import { isTruthySupportMode } from "../helpers/groupVisibility";

export const indexByTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId, id: userId, profile } = req.user;
  const supportMode = isTruthySupportMode((req.user as any).supportMode);
  const tid = parseInt(String(ticketId), 10);
  if (Number.isNaN(tid)) {
    return res.status(400).json({ error: "ticketId inválido" });
  }

  const ticket = await Ticket.findOne({
    where: { id: tid, companyId }
  });
  if (!ticket) {
    return res.status(404).json({ error: "Ticket não encontrado" });
  }

  await assertUserCanAccessTicketResource(
    { id: userId, profile, supportMode },
    toTicketAccessPayload(ticket),
    companyId,
    "FlowExecutionLogController.indexByTicket"
  );

  const rows = await listFlowExecutionLogsByTicket(tid, companyId);
  const logs = rows.map(r => {
    const j = r.toJSON() as Record<string, unknown>;
    return {
      id: j.id,
      ticketId: j.ticket_id,
      companyId: j.company_id,
      flowId: j.flow_id,
      nodeId: j.node_id,
      nodeType: j.node_type,
      eventType: j.event_type,
      status: j.status,
      details: j.details,
      createdAt: j.createdAt
    };
  });

  return res.status(200).json({ logs });
};
