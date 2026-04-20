import { Job } from "bull";
import { logger } from "../../utils/logger";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { IConnections, INodes } from "../WebhookService/DispatchWebHookService";
import { ActionsWebhookService, interpolateFlowMessage } from "../WebhookService/ActionsWebhookService";
import ShowTicketService from "../TicketServices/ShowTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import type { FlowMenuTimeoutJobData } from "./flowMenuTimeoutScheduler";

const delayMs = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

export async function processFlowMenuTimeout(job: Job<FlowMenuTimeoutJobData>): Promise<void> {
  const { ticketId, menuNodeId, idFlowDb, companyId, whatsappId } = job.data;

  const ticket = await Ticket.findOne({
    where: { id: ticketId, companyId },
    include: [{ model: Contact, as: "contact" }]
  });

  if (!ticket || !ticket.flowWebhook) {
    return;
  }
  if (String(ticket.lastFlowId) !== String(menuNodeId)) {
    return;
  }
  if (parseInt(String(ticket.flowStopped), 10) !== idFlowDb) {
    return;
  }

  const flow = await FlowBuilderModel.findByPk(idFlowDb);
  const rawFlow = flow?.flow as
    | { nodes?: INodes[]; connections?: IConnections[] }
    | undefined;
  if (!rawFlow?.nodes?.length || !rawFlow.connections) {
    return;
  }

  const nodes = rawFlow.nodes as INodes[];
  const connects = rawFlow.connections as IConnections[];

  const menuNode = nodes.find(n => n.id === menuNodeId);
  if (!menuNode || menuNode.type !== "menu") {
    return;
  }

  const timeoutEdge = connects.find(
    c => c.source === menuNodeId && String(c.sourceHandle || "") === "timeout"
  );

  if (!timeoutEdge) {
    logger.warn(
      { flowMenuTimeout: true, ticketId, menuNodeId },
      "[FlowBuilder] menu timeout: nenhuma aresta com sourceHandle \"timeout\""
    );
    return;
  }

  const menuData: Record<string, unknown> = (menuNode.data || {}) as Record<string, unknown>;
  const timeoutMessage = String(menuData.timeoutMessage || "").trim();

  if (timeoutMessage) {
    try {
      const ticketDetails = await ShowTicketService(ticket.id, companyId);
      const body = interpolateFlowMessage(
        timeoutMessage,
        ticket,
        ticketDetails.contact
      );
      await SendWhatsAppMessage({
        body,
        ticket: ticketDetails,
        quotedMsg: null
      });
      await delayMs(800);
    } catch (e) {
      logger.warn(
        { flowMenuTimeout: true, ticketId, err: e },
        "[FlowBuilder] menu timeout: falha ao enviar mensagem"
      );
    }
  }

  const contact = ticket.contact;
  const mountDataContact = {
    number: contact?.number || "",
    name: contact?.name || "",
    email: contact?.email || ""
  };

  await ActionsWebhookService(
    whatsappId,
    idFlowDb,
    companyId,
    nodes,
    connects,
    timeoutEdge.target,
    null,
    "",
    "",
    undefined,
    ticket.id,
    mountDataContact,
    undefined
  );
}
