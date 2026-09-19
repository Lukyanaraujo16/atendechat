import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { FlowCampaignModel } from "../../models/FlowCampaign";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import CreateTicketSystemMessageService from "../TicketServices/CreateTicketSystemMessageService";
import Company from "../../models/Company";
import { shouldBypassChatbot } from "../../helpers/shouldBypassChatbot";
import { formatChatbotBypassSystemMessage } from "../../helpers/chatbotBypassMessages";
import { parseTicketDataWebhook } from "../../helpers/GetTicketRemoteJid";
import { isFlowAutomationActive } from "../AiAgentService/isFlowAutomationActive";
import { logger } from "../../utils/logger";
import type { InboundAutomationContext } from "../../modules/whatsapp/automation/processInboundAutomation";
import type {
  IConnections,
  INodes
} from "../WebhookService/DispatchWebHookService";
import type { FlowInboundHint } from "./flowInboundHint";
import { resolveFirstFlowExecutableNodeId } from "./resolveFirstFlowExecutableNode";

/* Helpers abaixo são usados pelo dispatch; ordem de leitura do domínio. */
/* eslint-disable no-use-before-define */

export type InboundFlowDispatchReason =
  | "continuation"
  | "connection_start"
  | "queue_start"
  | "campaign"
  | "welcome"
  | "not_phrase"
  | "openai_deferred"
  | "openai_legacy"
  | "bypass"
  | "not_candidate";

export type InboundFlowDispatchResult = {
  handled: boolean;
  startedFlow: boolean;
  deferredOpenAi?: boolean;
  reason?: InboundFlowDispatchReason;
};

export type RunFlowActions = (input: {
  whatsappId: number;
  idFlowDb: number;
  companyId: number;
  nodes: INodes[];
  connections: IConnections[];
  nextStage: string;
  dataWebhook: unknown;
  details: unknown;
  hashWebhookId: string;
  pressKey?: string | null;
  idTicket: number;
  numberPhrase: { number: string; name: string; email: string } | "";
  inboundHint?: FlowInboundHint;
}) => Promise<unknown>;

export type DispatchInboundFlowDeps = {
  loadTicket?: (id: number, companyId: number) => Promise<Ticket | null>;
  showWhatsapp?: typeof ShowWhatsAppService;
  showIntegration?: typeof ShowQueueIntegrationService;
  findFlow?: (
    id: number,
    companyId: number
  ) => Promise<FlowBuilderModel | null>;
  findCampaigns?: (
    whatsappId: number,
    companyId: number
  ) => Promise<FlowCampaignModel[]>;
  runActions?: RunFlowActions;
  bypass?: typeof shouldBypassChatbot;
  updateTicket?: (input: {
    ticketData: Record<string, unknown>;
    ticketId: number;
    companyId: number;
  }) => Promise<unknown>;
  createSystemMessage?: typeof CreateTicketSystemMessageService;
  legacyOpenAiNode?: boolean;
};

async function defaultUpdateTicket(input: {
  ticketData: Record<string, unknown>;
  ticketId: number;
  companyId: number;
}) {
  const mod = await import("../TicketServices/UpdateTicketService");
  return mod.default(input as never);
}

async function defaultRunActions(input: Parameters<RunFlowActions>[0]) {
  const { ActionsWebhookService } = await import(
    "../WebhookService/ActionsWebhookService"
  );
  return ActionsWebhookService(
    input.whatsappId,
    input.idFlowDb,
    input.companyId,
    input.nodes,
    input.connections,
    input.nextStage,
    input.dataWebhook,
    input.details,
    input.hashWebhookId,
    input.pressKey ?? null,
    input.idTicket,
    input.numberPhrase,
    null,
    input.inboundHint
  );
}

function mountContact(ticket: Ticket): {
  number: string;
  name: string;
  email: string;
} {
  return {
    number: ticket.contact?.number || "",
    name: ticket.contact?.name || "",
    email: ticket.contact?.email || ""
  };
}

function inboundHintFromCtx(ctx: InboundAutomationContext): FlowInboundHint {
  return {
    remoteJid: ctx.inbound.addressing?.remoteJid || null,
    body: ctx.inbound.body || null
  };
}

export async function dispatchInboundFlow(
  ctx: InboundAutomationContext,
  options?: {
    forceStart?: boolean;
    legacyOpenAiNode?: boolean;
    deps?: DispatchInboundFlowDeps;
  }
): Promise<InboundFlowDispatchResult> {
  if (ctx.inbound.fromMe || ctx.inbound.isGroup || ctx.ticket.isGroup) {
    return { handled: false, startedFlow: false, reason: "not_candidate" };
  }
  if (ctx.ticket.userId != null && !options?.forceStart) {
    const activePreview = isFlowAutomationActive(ctx.ticket as Ticket);
    if (!activePreview.active) {
      return { handled: false, startedFlow: false, reason: "not_candidate" };
    }
  }

  const deps = options?.deps || {};
  const { companyId } = ctx.inbound;
  const loadTicket =
    deps.loadTicket ||
    ((id: number, cid: number) =>
      Ticket.findOne({
        where: { id, companyId: cid },
        include: [{ model: Contact, as: "contact" }]
      }));

  const ticket = await loadTicket(ctx.ticket.id, companyId);
  if (!ticket) {
    logger.warn(
      { ticketId: ctx.ticket.id, companyId },
      "[Flow] dispatch skipped: ticket not found for tenant"
    );
    return { handled: false, startedFlow: false, reason: "not_candidate" };
  }

  const bypass = deps.bypass || shouldBypassChatbot;
  const bypassDecision = await bypass({
    companyId,
    contact: ticket.contact,
    queueId: ticket.queueId,
    ticketId: ticket.id
  });
  if (bypassDecision.bypass) {
    const updateTicket = deps.updateTicket || defaultUpdateTicket;
    await updateTicket({
      ticketData: {
        status: "pending",
        chatbot: false,
        useIntegration: false,
        integrationId: null,
        promptId: null
      },
      ticketId: ticket.id,
      companyId
    });
    try {
      const company = await Company.findByPk(companyId, {
        attributes: ["language"]
      });
      const msg = formatChatbotBypassSystemMessage({
        reason: bypassDecision.reason,
        companyLanguage:
          (company as { language?: string } | null)?.language ?? "pt"
      });
      if (msg) {
        const createSys =
          deps.createSystemMessage || CreateTicketSystemMessageService;
        await createSys({ ticketId: ticket.id, companyId, body: msg });
      }
    } catch {
      // best-effort
    }
    return { handled: true, startedFlow: false, reason: "bypass" };
  }

  const active = isFlowAutomationActive(ticket);
  const flowStoppedRaw = ticket.flowStopped;
  const hasFlowId =
    flowStoppedRaw != null &&
    String(flowStoppedRaw).trim() !== "" &&
    String(flowStoppedRaw).trim() !== "0";
  if (hasFlowId && ticket.lastFlowId) {
    const findFlowPreview =
      deps.findFlow ||
      ((id: number, cid: number) =>
        FlowBuilderModel.findOne({ where: { id, company_id: cid } }));
    const previewFlow = await findFlowPreview(
      parseInt(String(ticket.flowStopped), 10),
      companyId
    );
    const previewNodes: INodes[] =
      (previewFlow?.flow as { nodes?: INodes[] } | undefined)?.nodes || [];
    const lastNodeType = previewNodes.find(
      n => n.id === ticket.lastFlowId
    )?.type;
    const waitingContinuation =
      lastNodeType === "waitForInteraction" ||
      lastNodeType === "question" ||
      lastNodeType === "menu" ||
      lastNodeType === "openai";
    if (active.active || waitingContinuation) {
      return continueActiveFlow(ctx, ticket, deps, options);
    }
  }

  const showIntegration = deps.showIntegration || ShowQueueIntegrationService;
  const connectionStart =
    ticket.queueId == null &&
    ctx.whatsapp.integrationId != null &&
    !ticket.useIntegration;
  const queuedStart =
    options?.forceStart === true ||
    (ticket.useIntegration === true &&
      ticket.integrationId != null &&
      ticket.queueId != null);

  let integrationId: number | null = null;
  if (connectionStart) {
    integrationId = Number(ctx.whatsapp.integrationId);
  } else if (queuedStart && ticket.integrationId != null) {
    integrationId = Number(ticket.integrationId);
  } else if (options?.forceStart && ctx.whatsapp.integrationId != null) {
    integrationId = Number(ctx.whatsapp.integrationId);
  }

  if (integrationId == null && !options?.forceStart) {
    return { handled: false, startedFlow: false, reason: "not_candidate" };
  }

  if (integrationId != null) {
    const integration = await showIntegration(integrationId, companyId);
    if (String(integration.type || "").toLowerCase() !== "flowbuilder") {
      return { handled: false, startedFlow: false, reason: "not_candidate" };
    }
  }

  return startFlowSession(
    ctx,
    ticket,
    deps,
    connectionStart ? "connection_start" : "queue_start"
  );
}

async function continueActiveFlow(
  ctx: InboundAutomationContext,
  ticket: Ticket,
  deps: DispatchInboundFlowDeps,
  options?: {
    forceStart?: boolean;
    legacyOpenAiNode?: boolean;
    deps?: DispatchInboundFlowDeps;
  }
): Promise<InboundFlowDispatchResult> {
  const { companyId } = ctx.inbound;
  const findFlow =
    deps.findFlow ||
    ((id: number, cid: number) =>
      FlowBuilderModel.findOne({ where: { id, company_id: cid } }));
  const flowId = parseInt(String(ticket.flowStopped), 10);
  if (!flowId) {
    return { handled: false, startedFlow: false, reason: "not_candidate" };
  }
  const flow = await findFlow(flowId, companyId);
  if (!flow?.flow) {
    logger.warn(
      { ticketId: ticket.id, flowId, companyId },
      "[Flow] continuation skipped: flow not found for tenant"
    );
    return { handled: false, startedFlow: false, reason: "not_candidate" };
  }

  const nodes: INodes[] = (flow.flow as { nodes?: INodes[] }).nodes || [];
  const connections: IConnections[] =
    (flow.flow as { connections?: IConnections[] }).connections || [];
  const lastNode = nodes.find(n => n.id === ticket.lastFlowId);
  const runActions = deps.runActions || defaultRunActions;
  const body = ctx.inbound.body || "";
  const hint = inboundHintFromCtx(ctx);

  if (lastNode?.type === "openai") {
    if (options?.legacyOpenAiNode || deps.legacyOpenAiNode) {
      return {
        handled: true,
        startedFlow: false,
        deferredOpenAi: true,
        reason: "openai_legacy"
      };
    }
    logger.info(
      { ticketId: ticket.id, companyId },
      "[Flow] OpenAI node continuation deferred (12.3-E)"
    );
    return {
      handled: true,
      startedFlow: false,
      deferredOpenAi: true,
      reason: "openai_deferred"
    };
  }

  if (lastNode?.type === "waitForInteraction") {
    const nextConnection = connections.find(
      c => c.source === ticket.lastFlowId
    );
    if (!nextConnection?.target) {
      return { handled: true, startedFlow: false, reason: "continuation" };
    }
    await ticket.update({ lastFlowId: nextConnection.target });
    await runActions({
      whatsappId: ctx.inbound.whatsappId,
      idFlowDb: flowId,
      companyId,
      nodes,
      connections,
      nextStage: nextConnection.target,
      dataWebhook: null,
      details: "",
      hashWebhookId: "",
      pressKey: null,
      idTicket: ticket.id,
      numberPhrase: mountContact(ticket),
      inboundHint: hint
    });
    return { handled: true, startedFlow: false, reason: "continuation" };
  }

  if (lastNode?.type === "question") {
    const answerKey = String(
      (lastNode.data as { typebotIntegration?: { answerKey?: string } })
        ?.typebotIntegration?.answerKey ?? ""
    ).trim();
    if (!answerKey) {
      logger.warn(
        { ticketId: ticket.id, lastFlowId: ticket.lastFlowId },
        "[Flow] question without answerKey"
      );
      return { handled: true, startedFlow: false, reason: "continuation" };
    }
    const nextConnection = connections.find(
      c => c.source === ticket.lastFlowId
    );
    if (!nextConnection?.target) {
      return { handled: true, startedFlow: false, reason: "continuation" };
    }
    const prevDw = parseTicketDataWebhook(ticket.dataWebhook);
    const prevVars =
      prevDw.variables &&
      typeof prevDw.variables === "object" &&
      !Array.isArray(prevDw.variables)
        ? (prevDw.variables as Record<string, unknown>)
        : {};
    await ticket.update({
      lastFlowId: nextConnection.target,
      dataWebhook: {
        ...prevDw,
        variables: { ...prevVars, [answerKey]: body }
      } as never
    });
    await runActions({
      whatsappId: ctx.inbound.whatsappId,
      idFlowDb: flowId,
      companyId,
      nodes,
      connections,
      nextStage: nextConnection.target,
      dataWebhook: null,
      details: "",
      hashWebhookId: "",
      pressKey: null,
      idTicket: ticket.id,
      numberPhrase: mountContact(ticket),
      inboundHint: hint
    });
    return { handled: true, startedFlow: false, reason: "continuation" };
  }

  await runActions({
    whatsappId: ctx.inbound.whatsappId,
    idFlowDb: flowId,
    companyId,
    nodes,
    connections,
    nextStage: String(ticket.lastFlowId),
    dataWebhook: ticket.dataWebhook,
    details: "",
    hashWebhookId: ticket.hashFlowId || "",
    pressKey: body,
    idTicket: ticket.id,
    numberPhrase: mountContact(ticket),
    inboundHint: hint
  });
  return { handled: true, startedFlow: false, reason: "continuation" };
}

async function startFlowSession(
  ctx: InboundAutomationContext,
  ticket: Ticket,
  deps: DispatchInboundFlowDeps,
  reason: InboundFlowDispatchReason
): Promise<InboundFlowDispatchResult> {
  const { companyId } = ctx.inbound;
  const showWhatsapp = deps.showWhatsapp || ShowWhatsAppService;
  const findFlow =
    deps.findFlow ||
    ((id: number, cid: number) =>
      FlowBuilderModel.findOne({ where: { id, company_id: cid } }));
  const findCampaigns =
    deps.findCampaigns ||
    ((whatsappId: number, cid: number) =>
      FlowCampaignModel.findAll({ where: { whatsappId, companyId: cid } }));
  const runActions = deps.runActions || defaultRunActions;
  const updateTicket = deps.updateTicket || defaultUpdateTicket;
  const whatsapp = await showWhatsapp(ctx.inbound.whatsappId, companyId);
  const body = ctx.inbound.body || "";
  const hint = inboundHintFromCtx(ctx);
  const campaigns = await findCampaigns(whatsapp.id, companyId);
  const matched = campaigns.filter(
    item =>
      item.phrase &&
      String(item.phrase).toLowerCase() === String(body).toLowerCase()
  );

  const runFlow = async (
    flowId: number,
    startReason: InboundFlowDispatchReason
  ): Promise<boolean> => {
    const flow = await findFlow(flowId, companyId);
    if (!flow?.flow) {
      logger.warn(
        { flowId, companyId, ticketId: ticket.id },
        "[Flow] start skipped: flow not found for tenant"
      );
      return false;
    }
    const nodes: INodes[] = (flow.flow as { nodes?: INodes[] }).nodes || [];
    const connections: IConnections[] =
      (flow.flow as { connections?: IConnections[] }).connections || [];
    const resolved = resolveFirstFlowExecutableNodeId(nodes, connections);
    if (!resolved.firstExecutableNodeId) {
      logger.warn(
        { flowId, ticketId: ticket.id },
        "[Flow] start skipped: no executable node"
      );
      return false;
    }
    await updateTicket({
      ticketData: { chatbot: true },
      ticketId: ticket.id,
      companyId
    });
    await runActions({
      whatsappId: whatsapp.id,
      idFlowDb: flowId,
      companyId,
      nodes,
      connections,
      nextStage: resolved.firstExecutableNodeId,
      dataWebhook: null,
      details: "",
      hashWebhookId: "",
      pressKey: null,
      idTicket: ticket.id,
      numberPhrase: mountContact(ticket),
      inboundHint: hint
    });
    logger.info(
      { ticketId: ticket.id, companyId, flowId, reason: startReason },
      "[Flow] inbound start"
    );
    return true;
  };

  if (matched.length > 0) {
    const started = await runFlow(matched[0].flowId, "campaign");
    return {
      handled: started,
      startedFlow: started,
      reason: started ? "campaign" : reason
    };
  }

  let startedAny = false;
  if (whatsapp.flowIdWelcome && !ticket.flowWebhook) {
    startedAny =
      (await runFlow(whatsapp.flowIdWelcome, "welcome")) || startedAny;
  }
  if (whatsapp.flowIdNotPhrase) {
    startedAny =
      (await runFlow(whatsapp.flowIdNotPhrase, "not_phrase")) || startedAny;
  }

  if (!startedAny) {
    return { handled: false, startedFlow: false, reason: "not_candidate" };
  }
  return { handled: true, startedFlow: true, reason };
}
