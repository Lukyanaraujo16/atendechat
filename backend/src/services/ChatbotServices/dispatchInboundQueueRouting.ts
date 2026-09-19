// eslint-disable-next-line import/no-extraneous-dependencies
import moment from "moment";
import formatBody from "../../helpers/Mustache";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import QueueOption from "../../models/QueueOption";
import Company from "../../models/Company";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowQueueIntegrationService from "../QueueIntegrationServices/ShowQueueIntegrationService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import CreateTicketSystemMessageService from "../TicketServices/CreateTicketSystemMessageService";
import { shouldBypassChatbot } from "../../helpers/shouldBypassChatbot";
import { formatChatbotBypassSystemMessage } from "../../helpers/chatbotBypassMessages";
import { resolveWhatsappSettings } from "../../helpers/resolveWhatsappSettings";
import { logger } from "../../utils/logger";
import type { InboundAutomationContext } from "../../modules/whatsapp/automation/processInboundAutomation";
import type { TypebotLegacyMediaCapability } from "../TypebotServices/typebotLegacyMedia";
import type typebotListener from "../TypebotServices/typebotListener";
import { releaseTicketFromChatbotToWaiting } from "./releaseTicketFromChatbotToWaiting";
import {
  formatQueueListText,
  formatQueueOptionsText,
  QueueMenuRenderCapability
} from "./queueMenuText";
import type { SendQueueRoutingText } from "./sendQueueRoutingText";

/* Helpers abaixo são usados pelo dispatch; ordem de leitura do domínio. */
/* eslint-disable no-use-before-define */

const isNil = (value: unknown): value is null | undefined =>
  value === null || value === undefined;

async function defaultSendText(
  ...args: Parameters<SendQueueRoutingText>
): Promise<void> {
  const mod = await import("./sendQueueRoutingText");
  return mod.sendQueueRoutingText(...args);
}

export type QueueRoutingDispatchResult = {
  handled: boolean;
  startedTypebot: boolean;
  deferredIntegration?: "flowbuilder" | "openai" | "n8n" | "webhook" | string;
  reason?: string;
};

type QueueRow = {
  id: number;
  name: string;
  greetingMessage?: string | null;
  integrationId?: number | null;
  promptId?: number | null;
  options?: Array<{ id: number; option?: string }>;
};

export type DispatchInboundQueueRoutingDeps = {
  showWhatsapp?: typeof ShowWhatsAppService;
  sendText?: SendQueueRoutingText;
  updateTicket?: (input: {
    ticketData: Record<string, unknown>;
    ticketId: number;
    companyId: number;
  }) => Promise<unknown>;
  bypass?: typeof shouldBypassChatbot;
  showIntegration?: typeof ShowQueueIntegrationService;
  runTypebot?: typeof typebotListener;
  loadTicket?: (id: number, companyId: number) => Promise<Ticket | null>;
  resolveSettings?: typeof resolveWhatsappSettings;
  findQueue?: (id: number, companyId: number) => Promise<Queue | null>;
  findQueueWithRootOptions?: (
    queueId: number,
    companyId: number
  ) => Promise<Queue | null>;
  findQueueOptionByPk?: (id: number) => Promise<QueueOption | null>;
  findQueueOption?: (where: {
    option?: string;
    parentId?: number | null;
    queueId?: number;
  }) => Promise<QueueOption | null>;
  findQueueOptions?: (where: {
    queueId?: number;
    parentId?: number | null;
  }) => Promise<QueueOption[]>;
  countQueueOptions?: (where: { parentId: number }) => Promise<number>;
  findTracking?: typeof FindOrCreateATicketTrakingService;
  createSystemMessage?: typeof CreateTicketSystemMessageService;
  findCompanyLanguage?: (companyId: number) => Promise<string | null>;
};

async function defaultUpdateTicket(input: {
  ticketData: Record<string, unknown>;
  ticketId: number;
  companyId: number;
}) {
  const mod = await import("../TicketServices/UpdateTicketService");
  return mod.default(input as never);
}

async function defaultRunTypebot(...args: Parameters<typeof typebotListener>) {
  const mod = await import("../TypebotServices/typebotListener");
  return mod.default(...args);
}

function isHashCommand(body: string | null | undefined): boolean {
  return String(body || "").trim() === "#";
}

function queueHasOptions(queue: QueueRow | null | undefined): boolean {
  return Boolean(queue?.options && queue.options.length > 0);
}

export async function dispatchInboundQueueRouting(
  ctx: InboundAutomationContext,
  options?: {
    media?: TypebotLegacyMediaCapability;
    menuRender?: QueueMenuRenderCapability;
    deps?: DispatchInboundQueueRoutingDeps;
  }
): Promise<QueueRoutingDispatchResult> {
  if (ctx.inbound.fromMe || ctx.inbound.isGroup || ctx.ticket.isGroup) {
    return { handled: false, startedTypebot: false, reason: "not_candidate" };
  }
  const body = ctx.inbound.body || "";
  if (ctx.ticket.userId != null && !isHashCommand(body)) {
    return { handled: false, startedTypebot: false, reason: "has_user" };
  }

  const deps = options?.deps || {};
  const { companyId } = ctx.inbound;
  const loadTicket =
    deps.loadTicket ||
    ((id: number, cid: number) =>
      Ticket.findOne({ where: { id, companyId: cid } }));

  const ticket = await loadTicket(ctx.ticket.id, companyId);
  if (!ticket) {
    logger.warn(
      { ticketId: ctx.ticket.id, companyId },
      "[QueueRouting] ticket not found for tenant"
    );
    return {
      handled: false,
      startedTypebot: false,
      reason: "ticket_not_found"
    };
  }

  const showWhatsapp = deps.showWhatsapp || ShowWhatsAppService;
  const whatsappSession = await showWhatsapp(ctx.inbound.whatsappId, companyId);
  const queues = (whatsappSession.queues || []) as QueueRow[];

  const resolveSettings = deps.resolveSettings || resolveWhatsappSettings;
  const settings = await resolveSettings(
    ticket.whatsappId ?? ctx.inbound.whatsappId,
    companyId,
    "queueRouting"
  );

  let startedTypebot = false;
  let deferredIntegration: QueueRoutingDispatchResult["deferredIntegration"];

  const run = async (): Promise<QueueRoutingDispatchResult> => {
    const hashReset = isHashCommand(body);
    if (hashReset) {
      const updateTicket = deps.updateTicket || defaultUpdateTicket;
      await updateTicket({
        ticketData: {
          status: "pending",
          queueOptionId: null,
          chatbot: false,
          queueId: null,
          userId: null
        },
        ticketId: ticket.id,
        companyId
      });
      await ticket.reload();
    }

    const noQueue = ticket.queueId == null;
    const shouldVerify =
      ((noQueue && !ticket.useIntegration) || hashReset) && queues.length >= 1;

    if (shouldVerify) {
      const verify = await runVerifyQueue({
        ctx,
        ticket,
        queues,
        whatsappSession,
        settings,
        companyId,
        menuRender: options?.menuRender,
        media: options?.media,
        deps
      });
      startedTypebot = startedTypebot || verify.startedTypebot;
      deferredIntegration = deferredIntegration || verify.deferredIntegration;
      await ticket.reload();
      const findTracking =
        deps.findTracking || FindOrCreateATicketTrakingService;
      const tracking = await findTracking({
        ticketId: ticket.id,
        companyId
      });
      if (tracking && tracking.chatbotAt === null) {
        await tracking.update({
          chatbotAt: moment().toDate()
        });
      }
    }

    const shouldChatbot =
      Boolean(ticket.queueId && ticket.chatbot) && !hashReset;
    if (shouldChatbot) {
      const dontReadTheFirstQuestion = shouldVerify && queues.length > 1;
      await runHandleChatbot({
        ctx,
        ticket,
        settings,
        companyId,
        dontReadTheFirstQuestion,
        menuRender: options?.menuRender,
        deps
      });
    }

    if (!shouldVerify && !shouldChatbot && !hashReset) {
      return { handled: false, startedTypebot: false, reason: "not_candidate" };
    }

    let reason = "handle_chatbot";
    if (hashReset) {
      reason = "hash_reset";
    } else if (shouldVerify) {
      reason = "verify_queue";
    }
    return {
      handled: true,
      startedTypebot,
      deferredIntegration,
      reason
    };
  };

  return run();
}

async function runVerifyQueue(input: {
  ctx: InboundAutomationContext;
  ticket: Ticket;
  queues: QueueRow[];
  whatsappSession: {
    greetingMessage?: string | null;
    maxUseBotQueues?: number;
    timeUseBotQueues?: string | number | null;
  };
  settings: Awaited<ReturnType<typeof resolveWhatsappSettings>>;
  companyId: number;
  menuRender?: QueueMenuRenderCapability;
  media?: TypebotLegacyMediaCapability;
  deps: DispatchInboundQueueRoutingDeps;
}): Promise<{
  startedTypebot: boolean;
  deferredIntegration?: QueueRoutingDispatchResult["deferredIntegration"];
}> {
  const {
    ctx,
    ticket,
    queues,
    whatsappSession,
    settings,
    companyId,
    menuRender,
    media,
    deps
  } = input;
  const sendText = deps.sendText || defaultSendText;
  const updateTicket = deps.updateTicket || defaultUpdateTicket;
  const bypass = deps.bypass || shouldBypassChatbot;
  const { contact } = ticket;

  const { greetingMessage, maxUseBotQueues, timeUseBotQueues } =
    whatsappSession;
  const connectionGreetingTrim =
    greetingMessage != null && String(greetingMessage).trim() !== ""
      ? String(greetingMessage).trim()
      : "";

  const bypassDecision = await bypass({
    companyId: ticket.companyId,
    contact,
    queueId: ticket.queueId,
    ticketId: ticket.id
  });

  if (bypassDecision.bypass) {
    let fallbackQueueId: number | null = null;
    if (ticket.queueId != null) {
      fallbackQueueId = ticket.queueId;
    } else if (queues.length >= 1) {
      fallbackQueueId = queues[0]?.id ?? null;
    }
    await updateTicket({
      ticketData: {
        status: "pending",
        queueId: fallbackQueueId,
        chatbot: false,
        useIntegration: false,
        integrationId: null,
        promptId: null
      },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });
    try {
      const findLang =
        deps.findCompanyLanguage ||
        (async (cid: number) => {
          const company = await Company.findByPk(cid, {
            attributes: ["language"]
          });
          return (company as { language?: string } | null)?.language ?? "pt";
        });
      const msg = formatChatbotBypassSystemMessage({
        reason: bypassDecision.reason,
        companyLanguage: (await findLang(ticket.companyId)) ?? "pt"
      });
      if (msg) {
        const createSys =
          deps.createSystemMessage || CreateTicketSystemMessageService;
        await createSys({
          ticketId: ticket.id,
          companyId: ticket.companyId,
          body: msg
        });
      }
    } catch {
      // best-effort
    }
    return { startedTypebot: false };
  }

  if (queues.length === 1) {
    const { autoMessages } = settings;
    if (
      connectionGreetingTrim.length > 1 &&
      autoMessages?.sendGreetingMessageOneQueues === "enabled"
    ) {
      await sendText(ticket, `${connectionGreetingTrim}`, ctx.inbound);
    }

    const firstQueue = queues[0];
    const chatbot = queueHasOptions(firstQueue);

    const started = await maybeStartQueueIntegration({
      ticket,
      queue: firstQueue,
      ctx,
      media,
      deps
    });

    await updateTicket({
      ticketData: { queueId: firstQueue.id, chatbot, status: "pending" },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });

    return started;
  }

  const selectedOption = ctx.inbound.body || "";
  const choosenQueue = queues[+selectedOption - 1];
  const { chatBotType } = settings;

  const sendQueueList = async () => {
    const text = formatQueueListText(connectionGreetingTrim, queues);
    await sendText(ticket, text, ctx.inbound);
  };

  if (choosenQueue) {
    const chatbot = queueHasOptions(choosenQueue);
    await updateTicket({
      ticketData: { queueId: choosenQueue.id, chatbot },
      ticketId: ticket.id,
      companyId: ticket.companyId
    });
    await ticket.reload();

    const effectiveScheduleTypeMenu = settings.scheduleType;

    if (
      effectiveScheduleTypeMenu === "queue" &&
      !queueHasOptions(choosenQueue)
    ) {
      const findQueue =
        deps.findQueue ||
        ((id: number, cid: number) =>
          Queue.findOne({ where: { id, companyId: cid } }));
      const queue = await findQueue(choosenQueue.id, companyId);
      const schedules = (queue as Queue & { schedules?: unknown })
        ?.schedules as
        | Array<{
            weekdayEn?: string;
            startTime?: string | null;
            endTime?: string | null;
          }>
        | undefined;
      const now = moment();
      const weekday = now.format("dddd").toLowerCase();
      let schedule:
        | { startTime?: string | null; endTime?: string | null }
        | undefined;
      if (Array.isArray(schedules) && schedules.length > 0) {
        schedule = schedules.find(
          s =>
            s.weekdayEn === weekday &&
            s.startTime !== "" &&
            s.startTime !== null &&
            s.endTime !== "" &&
            s.endTime !== null
        );
      }

      if (
        queue &&
        queue.outOfHoursMessage !== null &&
        queue.outOfHoursMessage !== "" &&
        !isNil(schedule)
      ) {
        const startTime = moment(schedule.startTime, "HH:mm");
        const endTime = moment(schedule.endTime, "HH:mm");

        if (now.isBefore(startTime) || now.isAfter(endTime)) {
          const body = `\u200e ${queue.outOfHoursMessage}\n\n*[ # ]* - Voltar ao Menu Principal`;
          await sendText(ticket, body, ctx.inbound);
          await updateTicket({
            ticketData: { queueId: null, chatbot },
            ticketId: ticket.id,
            companyId: ticket.companyId
          });
          return { startedTypebot: false };
        }
      }

      const started = await maybeStartQueueIntegration({
        ticket,
        queue: choosenQueue,
        ctx,
        media,
        deps
      });

      if (choosenQueue.greetingMessage) {
        const body = `\u200e${choosenQueue.greetingMessage}`;
        await sendText(ticket, body, ctx.inbound);
      }
      return started;
    }

    return { startedTypebot: false };
  }

  if (
    maxUseBotQueues &&
    maxUseBotQueues !== 0 &&
    (ticket.amountUsedBotQueues || 0) >= maxUseBotQueues
  ) {
    return { startedTypebot: false };
  }

  const findTracking = deps.findTracking || FindOrCreateATicketTrakingService;
  const ticketTraking = await findTracking({
    ticketId: ticket.id,
    companyId
  });
  const dataLimite = new Date();
  const agora = new Date();

  if (ticketTraking.chatbotAt !== null) {
    dataLimite.setMinutes(
      ticketTraking.chatbotAt.getMinutes() + Number(timeUseBotQueues)
    );

    if (
      ticketTraking.chatbotAt !== null &&
      agora < dataLimite &&
      String(timeUseBotQueues) !== "0" &&
      ticket.amountUsedBotQueues !== 0
    ) {
      return { startedTypebot: false };
    }
  }
  await ticketTraking.update({
    chatbotAt: null
  });

  const canSendTextMenu =
    chatBotType === "text" || !menuRender?.sendInteractiveMenu;
  if (canSendTextMenu) {
    await sendQueueList();
  }

  return { startedTypebot: false };
}

async function maybeStartQueueIntegration(input: {
  ticket: Ticket;
  queue: QueueRow;
  ctx: InboundAutomationContext;
  media?: TypebotLegacyMediaCapability;
  deps: DispatchInboundQueueRoutingDeps;
}): Promise<{
  startedTypebot: boolean;
  deferredIntegration?: QueueRoutingDispatchResult["deferredIntegration"];
}> {
  const { ticket, queue, ctx, media, deps } = input;
  if (ctx.inbound.fromMe || ticket.isGroup) {
    return { startedTypebot: false };
  }

  if (!isNil(queue.integrationId)) {
    const showIntegration = deps.showIntegration || ShowQueueIntegrationService;
    const integration = await showIntegration(
      queue.integrationId,
      ctx.inbound.companyId
    );
    const type = String(integration.type || "").toLowerCase();

    if (type === "typebot") {
      const runTypebot = deps.runTypebot || defaultRunTypebot;
      await runTypebot({
        ticket,
        typebot: integration,
        inbound: {
          body: ctx.inbound.body,
          pushName: ctx.inbound.pushName,
          addressing: ctx.inbound.addressing,
          fromMe: ctx.inbound.fromMe
        },
        media
      });
      await ticket.update({
        useIntegration: true,
        integrationId: integration.id
      });
      return { startedTypebot: true };
    }

    logger.info(
      {
        ticketId: ticket.id,
        companyId: ctx.inbound.companyId,
        integrationId: integration.id,
        type
      },
      "[QueueRouting] queue integration deferred (12.3-D)"
    );
    return {
      startedTypebot: false,
      deferredIntegration: type === "flowbuilder" ? "flowbuilder" : type
    };
  }

  if (!isNil(queue.promptId)) {
    logger.info(
      {
        ticketId: ticket.id,
        companyId: ctx.inbound.companyId,
        promptId: queue.promptId
      },
      "[QueueRouting] OpenAI legado deferred (12.3-D)"
    );
    return { startedTypebot: false, deferredIntegration: "openai" };
  }

  return { startedTypebot: false };
}

async function runHandleChatbot(input: {
  ctx: InboundAutomationContext;
  ticket: Ticket;
  settings: Awaited<ReturnType<typeof resolveWhatsappSettings>>;
  companyId: number;
  dontReadTheFirstQuestion: boolean;
  menuRender?: QueueMenuRenderCapability;
  deps: DispatchInboundQueueRoutingDeps;
}): Promise<void> {
  const {
    ctx,
    ticket,
    settings,
    companyId,
    dontReadTheFirstQuestion,
    menuRender,
    deps
  } = input;
  const sendText = deps.sendText || defaultSendText;
  const messageBody = ctx.inbound.body || "";

  const findQueueWithRootOptions =
    deps.findQueueWithRootOptions ||
    ((queueId: number, cid: number) =>
      Queue.findOne({
        where: { id: queueId, companyId: cid },
        include: [
          {
            model: QueueOption,
            as: "options",
            where: { parentId: null },
            required: false,
            order: [
              ["option", "ASC"],
              ["createdAt", "ASC"]
            ]
          }
        ]
      }));

  const queue = await findQueueWithRootOptions(ticket.queueId, companyId);

  if (isHashCommand(messageBody)) {
    return;
  }

  const findQueueOptionByPk =
    deps.findQueueOptionByPk || ((id: number) => QueueOption.findByPk(id));
  const countQueueOptions =
    deps.countQueueOptions ||
    ((where: { parentId: number }) => QueueOption.count({ where }));
  const findQueueOption =
    deps.findQueueOption ||
    ((where: { option?: string; parentId?: number | null; queueId?: number }) =>
      QueueOption.findOne({ where }));
  const findQueueOptions =
    deps.findQueueOptions ||
    ((where: { queueId?: number; parentId?: number | null }) =>
      QueueOption.findAll({
        where,
        order: [
          ["option", "ASC"],
          ["createdAt", "ASC"]
        ]
      }));

  if (!isNil(queue) && !isNil(ticket.queueOptionId) && messageBody === "0") {
    const option = await findQueueOptionByPk(ticket.queueOptionId);
    await ticket.update({ queueOptionId: option?.parentId ?? null });
  } else if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const count = await countQueueOptions({ parentId: ticket.queueOptionId });
    if (count === 0) {
      await releaseTicketFromChatbotToWaiting(ticket, companyId);
      return;
    }
    let option: QueueOption | null = null;
    if (count === 1) {
      option = await findQueueOption({ parentId: ticket.queueOptionId });
    } else {
      option = await findQueueOption({
        option: messageBody || "",
        parentId: ticket.queueOptionId
      });
    }
    if (option) {
      await ticket.update({ queueOptionId: option.id });
      const childCount = await countQueueOptions({ parentId: option.id });
      if (childCount === 0) {
        await ticket.reload();
        await releaseTicketFromChatbotToWaiting(ticket, companyId);
        return;
      }
    }
  } else if (
    !isNil(queue) &&
    isNil(ticket.queueOptionId) &&
    !dontReadTheFirstQuestion
  ) {
    const option = (queue.options || []).find(
      // eslint-disable-next-line eqeqeq
      o => o.option == messageBody
    );
    if (option) {
      await ticket.update({ queueOptionId: option.id });
      const childCount = await countQueueOptions({ parentId: option.id });
      if (childCount === 0) {
        await ticket.reload();
        await releaseTicketFromChatbotToWaiting(ticket, companyId);
        return;
      }
    }
  }

  await ticket.reload();

  if (!isNil(queue) && isNil(ticket.queueOptionId)) {
    const queueOptions = await findQueueOptions({
      queueId: ticket.queueId,
      parentId: null
    });
    await renderQueueOptionsMenu({
      ticket,
      heading: queue.greetingMessage || "",
      options: queueOptions,
      includeBack: false,
      chatBotType: settings.chatBotType,
      submenu: false,
      menuRender,
      sendText,
      inbound: ctx.inbound
    });
    return;
  }

  if (!isNil(queue) && !isNil(ticket.queueOptionId)) {
    const currentOption = await findQueueOptionByPk(ticket.queueOptionId);
    const queueOptions = await findQueueOptions({
      parentId: ticket.queueOptionId
    });

    if (queueOptions.length === 0) {
      await releaseTicketFromChatbotToWaiting(ticket, companyId);
      return;
    }

    await renderQueueOptionsMenu({
      ticket,
      heading: currentOption?.message || "",
      options: queueOptions,
      includeBack: true,
      chatBotType: settings.chatBotType,
      submenu: true,
      menuRender,
      sendText,
      inbound: ctx.inbound
    });
  }
}

async function renderQueueOptionsMenu(input: {
  ticket: Ticket;
  heading: string;
  options: QueueOption[];
  includeBack: boolean;
  chatBotType: string;
  submenu: boolean;
  menuRender?: QueueMenuRenderCapability;
  sendText: SendQueueRoutingText;
  inbound: InboundAutomationContext["inbound"];
}): Promise<void> {
  const {
    ticket,
    heading,
    options,
    includeBack,
    chatBotType,
    submenu,
    menuRender,
    sendText,
    inbound
  } = input;

  const text = formatQueueOptionsText(
    heading,
    options.map(o => ({ option: o.option, title: o.title })),
    includeBack
  );

  const interactive = menuRender?.sendInteractiveMenu;
  const optionCount = options.length;
  const items = [
    ...options.map(o => ({ id: String(o.option), title: o.title })),
    {
      id: "#",
      title: "Menu inicial *[ 0 ]* Menu anterior"
    }
  ];

  const headingText = formatBody(`\u200e${heading}`, ticket.contact);

  if (submenu && chatBotType === "list" && interactive) {
    await interactive({
      kind: "list",
      text: headingText,
      items
    });
    return;
  }

  if (chatBotType === "button" && optionCount <= 4 && interactive) {
    await interactive({
      kind: "button",
      text: headingText,
      items
    });
    return;
  }

  if (chatBotType === "text" || !interactive || optionCount > 4) {
    await sendText(ticket, text, inbound);
  }
}
