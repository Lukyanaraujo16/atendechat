import Ticket from "../../models/Ticket";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import { logger } from "../../utils/logger";
import type {
  InboundAutomationContext,
  InboundAutomationTicket,
  InboundAutomationWhatsapp
} from "../../modules/whatsapp/automation/processInboundAutomation";
import type { TypebotLegacyMediaCapability } from "./typebotLegacyMedia";
import type { TypebotListenerDeps } from "./typebotListener";
import type typebotListener from "./typebotListener";

export type InboundTypebotDispatchReason =
  | "connection_start"
  | "queued_session"
  | "connection_session";

export type InboundTypebotDispatchResult = {
  handled: boolean;
  halt: boolean;
  reason?: InboundTypebotDispatchReason | "not_typebot" | "not_candidate";
};

/**
 * Política compartilhada Baileys/Evolution para acionar Typebot no inbound.
 * Espelha os gates de handleMessage (conexão / sessão) sem WASocket.
 */
export function resolveInboundTypebotDispatch(
  ticket: InboundAutomationTicket,
  whatsapp: InboundAutomationWhatsapp
): {
  candidate: boolean;
  integrationId: number | null;
  halt: boolean;
  reason?: InboundTypebotDispatchReason;
} {
  if (ticket.userId != null) {
    return { candidate: false, integrationId: null, halt: false };
  }
  if (ticket.isGroup) {
    return { candidate: false, integrationId: null, halt: false };
  }

  const hasTypebotSession =
    ticket.typebotSessionId != null &&
    String(ticket.typebotSessionId).trim() !== "";

  const connectionStart =
    ticket.queueId == null &&
    whatsapp.integrationId != null &&
    !ticket.useIntegration;

  const connectionRestart =
    ticket.queueId == null &&
    whatsapp.integrationId != null &&
    ticket.useIntegration === true &&
    ticket.typebotStatus === true &&
    !hasTypebotSession;

  if (connectionStart || connectionRestart) {
    return {
      candidate: true,
      integrationId: Number(whatsapp.integrationId),
      halt: true,
      reason: "connection_start"
    };
  }

  const queuedSession =
    ticket.useIntegration === true &&
    ticket.integrationId != null &&
    ticket.queueId != null;

  if (queuedSession) {
    return {
      candidate: true,
      integrationId: Number(ticket.integrationId),
      halt: false,
      reason: "queued_session"
    };
  }

  const connectionSession =
    ticket.useIntegration === true &&
    ticket.integrationId != null &&
    ticket.typebotStatus === true &&
    ticket.typebotSessionId != null &&
    String(ticket.typebotSessionId).trim() !== "";

  if (connectionSession) {
    return {
      candidate: true,
      integrationId: Number(ticket.integrationId),
      halt: false,
      reason: "connection_session"
    };
  }

  return { candidate: false, integrationId: null, halt: false };
}

export type DispatchInboundTypebotDeps = {
  loadTicket?: (id: number, companyId: number) => Promise<Ticket | null>;
  showIntegration?: typeof ShowQueueIntegrationService;
  runTypebot?: typeof typebotListener;
  typebotDeps?: TypebotListenerDeps;
};

export async function dispatchInboundTypebot(
  ctx: InboundAutomationContext,
  options?: {
    media?: TypebotLegacyMediaCapability;
    deps?: DispatchInboundTypebotDeps;
  }
): Promise<InboundTypebotDispatchResult> {
  const resolved = resolveInboundTypebotDispatch(ctx.ticket, ctx.whatsapp);
  if (!resolved.candidate || resolved.integrationId == null) {
    return { handled: false, halt: false, reason: "not_candidate" };
  }

  const showIntegration =
    options?.deps?.showIntegration || ShowQueueIntegrationService;
  const integration = await showIntegration(
    resolved.integrationId,
    ctx.inbound.companyId
  );

  if (String(integration.type || "").toLowerCase() !== "typebot") {
    return { handled: false, halt: false, reason: "not_typebot" };
  }

  const loadTicket =
    options?.deps?.loadTicket ||
    ((id: number, companyId: number) =>
      Ticket.findOne({ where: { id, companyId } }));

  const ticketRow = await loadTicket(ctx.ticket.id, ctx.inbound.companyId);
  if (!ticketRow) {
    logger.warn(
      {
        ticketId: ctx.ticket.id,
        companyId: ctx.inbound.companyId
      },
      "[Typebot] dispatch skipped: ticket not found for tenant"
    );
    return { handled: false, halt: false, reason: "not_candidate" };
  }

  const runTypebot: typeof typebotListener =
    options?.deps?.runTypebot || (await import("./typebotListener")).default;

  logger.info(
    {
      ticketId: ticketRow.id,
      companyId: ctx.inbound.companyId,
      whatsappId: ctx.inbound.whatsappId,
      reason: resolved.reason,
      integrationId: integration.id
    },
    "[Typebot] inbound dispatch"
  );

  await runTypebot(
    {
      ticket: ticketRow,
      typebot: integration,
      inbound: {
        body: ctx.inbound.body,
        pushName: ctx.inbound.pushName,
        addressing: ctx.inbound.addressing,
        fromMe: ctx.inbound.fromMe
      },
      media: options?.media
    },
    options?.deps?.typebotDeps
  );

  return {
    handled: true,
    halt: resolved.halt,
    reason: resolved.reason
  };
}
