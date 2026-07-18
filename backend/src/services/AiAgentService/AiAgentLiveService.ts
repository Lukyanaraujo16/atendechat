import AiAgent from "../../models/AiAgent";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { debounce } from "../../helpers/Debounce";
import { logger } from "../../utils/logger";
import { buildAiAgentProviderResponse } from "./buildAiAgentProviderResponse";
import {
  AI_AGENT_LIVE_DEBOUNCE_MS,
  AI_AGENT_LIVE_MAX_TOKENS_CAP,
  AI_AGENT_LIVE_SOURCE,
  AI_AGENT_LIVE_TIMEOUT_MS
} from "./aiAgentLiveConfig";
import {
  AI_AGENT_LIVE_DELIVERY_STATUSES,
  AI_AGENT_LIVE_ERROR_CODES,
  AI_AGENT_LIVE_STATUSES
} from "./aiAgentLiveErrors";
import {
  claimLiveGeneration,
  claimLiveSending,
  markSupersededLiveLogs,
  mergeAiAgentLiveLogMetadata,
  updateAiAgentLiveLog
} from "./AiAgentLiveLogService";
import { resolveWhatsappAiAgentRuntimeMode } from "./aiAgentRuntimeMode";
import { InboundMessageClassification } from "./classifyInboundMessage";
import { checkAiAgentLiveLimits } from "./checkAiAgentLiveLimits";
import sendAiAgentWhatsappMessage from "./sendAiAgentWhatsappMessage";
import { validateAiAgentLiveResponse } from "./validateAiAgentLiveResponse";
import { isFlowAutomationActive } from "./isFlowAutomationActive";
import { isTicketIntegrationActive } from "./isTicketIntegrationActive";
import { parseAiAgentHandoffSignal } from "./parseAiAgentHandoffSignal";
import applyAiAgentHandoffToTicket from "./applyAiAgentHandoffToTicket";
import { maybeApplySafetyHandoffForLiveBlock } from "./maybeApplySafetyHandoffForLiveBlock";
import {
  acquireAiAgentGenerationLock,
  releaseAiAgentGenerationLock
} from "./knowledge/aiAgentGenerationLock";

const inFlightLiveTickets = new Set<number>();

async function loadLiveEntities(log: AiAgentRuntimeLog): Promise<{
  ticket: Ticket;
  contact: Contact;
  whatsapp: Whatsapp;
  agent: AiAgent;
} | null> {
  const ticket = await Ticket.findOne({
    where: { id: log.ticketId, companyId: log.companyId }
  });
  const contact = log.contactId
    ? await Contact.findOne({
        where: { id: log.contactId, companyId: log.companyId }
      })
    : null;
  const whatsapp = log.whatsappId
    ? await Whatsapp.findOne({
        where: { id: log.whatsappId, companyId: log.companyId }
      })
    : null;
  const agent = log.aiAgentId
    ? await AiAgent.findOne({
        where: { id: log.aiAgentId, companyId: log.companyId }
      })
    : null;

  if (!ticket || !contact || !whatsapp || !agent) {
    return null;
  }
  return { ticket, contact, whatsapp, agent };
}

async function assertTicketStillEligibleForLive(
  ticket: Ticket,
  whatsapp: Whatsapp
): Promise<string | null> {
  if (resolveWhatsappAiAgentRuntimeMode(whatsapp) !== "live") {
    return AI_AGENT_LIVE_ERROR_CODES.NOT_LIVE_MODE;
  }
  if (ticket.userId != null) {
    return AI_AGENT_LIVE_ERROR_CODES.LIVE_HUMAN_ASSUMED;
  }
  if (ticket.aiAgentHandoffRequested === true) {
    return AI_AGENT_LIVE_ERROR_CODES.LIVE_HANDOFF_REQUESTED;
  }
  if (ticket.aiAgentPaused === true) {
    return AI_AGENT_LIVE_ERROR_CODES.LIVE_PAUSED_FOR_TICKET;
  }
  if (ticket.isGroup) {
    return AI_AGENT_LIVE_ERROR_CODES.NOT_ELIGIBLE;
  }
  if (ticket.status === "closed") {
    return AI_AGENT_LIVE_ERROR_CODES.NOT_ELIGIBLE;
  }
  if (ticket.chatbot === true) {
    return AI_AGENT_LIVE_ERROR_CODES.NOT_ELIGIBLE;
  }
  const flow = isFlowAutomationActive(ticket);
  if (flow.active) {
    return AI_AGENT_LIVE_ERROR_CODES.NOT_ELIGIBLE;
  }
  const integration = await isTicketIntegrationActive(ticket);
  if (integration.active) {
    return AI_AGENT_LIVE_ERROR_CODES.NOT_ELIGIBLE;
  }
  return null;
}

export async function generateAndSendLiveResponseForLog(
  logId: number,
  companyId: number,
  inboundText: string,
  classification: InboundMessageClassification
): Promise<void> {
  if (!classification.hasText) {
    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.NOT_ELIGIBLE
    });
    return;
  }

  const log = await AiAgentRuntimeLog.findOne({
    where: { id: logId, companyId }
  });
  if (!log || !log.eligible || log.mode !== "live") {
    return;
  }

  if (
    log.liveStatus === AI_AGENT_LIVE_STATUSES.SENT ||
    log.liveStatus === AI_AGENT_LIVE_STATUSES.SENDING
  ) {
    return;
  }

  const entities = await loadLiveEntities(log);
  if (!entities) {
    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.CONTEXT_BUILD_FAILED
    });
    return;
  }

  const { ticket, contact, whatsapp, agent } = entities;
  const blockReason = await assertTicketStillEligibleForLive(ticket, whatsapp);
  if (blockReason) {
    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
      errorCode: blockReason
    });
    return;
  }

  if (!agent.enabled) {
    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.NOT_ELIGIBLE
    });
    return;
  }

  const limits = await checkAiAgentLiveLimits({
    companyId,
    ticketId: ticket.id
  });
  if (limits.allowed === false) {
    await maybeApplySafetyHandoffForLiveBlock({
      ticket,
      companyId,
      errorCode: limits.errorCode
    });
    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
      errorCode: limits.errorCode
    });
    return;
  }

  if (inFlightLiveTickets.has(ticket.id)) {
    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.DEBOUNCED_SUPERSEDED
    });
    return;
  }

  const claimed = await claimLiveGeneration(logId, companyId);
  if (!claimed) {
    return;
  }

  const lock = await acquireAiAgentGenerationLock({
    channel: "live",
    companyId,
    logId
  });
  if (!lock.acquired) {
    return;
  }

  inFlightLiveTickets.add(ticket.id);
  const startedAt = Date.now();

  try {
    const freshTicket = await Ticket.findOne({
      where: { id: ticket.id, companyId }
    });
    if (!freshTicket) {
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
        errorCode: AI_AGENT_LIVE_ERROR_CODES.CONTEXT_BUILD_FAILED
      });
      return;
    }

    const freshBlock = await assertTicketStillEligibleForLive(freshTicket, whatsapp);
    if (freshBlock) {
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
        errorCode: freshBlock
      });
      return;
    }

    const generation = await buildAiAgentProviderResponse({
      companyId,
      ticket: freshTicket,
      contact,
      whatsapp,
      agent,
      inboundText,
      source: AI_AGENT_LIVE_SOURCE,
      timeoutMs: AI_AGENT_LIVE_TIMEOUT_MS,
      maxTokensCap: AI_AGENT_LIVE_MAX_TOKENS_CAP,
      logId,
      knowledgeChannel: "live",
      messageId: log.messageId || null
    });

    await mergeAiAgentLiveLogMetadata(logId, companyId, {
      credentialSource: generation.credentialSource ?? "missing",
      credentialId: generation.credentialId ?? null,
      ...(generation.knowledgeMeta || {})
    });

    if (generation.ok === false) {
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: generation.isRateLimited
          ? AI_AGENT_LIVE_STATUSES.RATE_LIMITED
          : AI_AGENT_LIVE_STATUSES.FAILED,
        errorCode: generation.errorCode,
        liveModel: generation.model ?? null,
        liveProvider: generation.provider ?? null,
        liveLatencyMs: generation.latencyMs,
        contextMessageCount: generation.contextMessageCount ?? null,
        contextHash: generation.contextHash ?? null
      });
      return;
    }

    const handoffSignal = parseAiAgentHandoffSignal(generation.text);
    if (generation.forceHandoff && !handoffSignal.handoffRequested) {
      handoffSignal.handoffRequested = true;
      handoffSignal.handoffReason =
        handoffSignal.handoffReason || "knowledge_missing";
    }
    const validated = validateAiAgentLiveResponse(handoffSignal.cleanText);
    if (validated.ok === false) {
      if (handoffSignal.handoffRequested) {
        await applyAiAgentHandoffToTicket({
          ticket: freshTicket,
          companyId,
          reason: handoffSignal.handoffReason ?? "model_requested_handoff",
          by: "ai_agent"
        });
        await mergeAiAgentLiveLogMetadata(logId, companyId, {
          handoffRequested: true,
          handoffReason: handoffSignal.handoffReason,
          handoffMarkerDetected: true,
          handoffAppliedAt: new Date().toISOString(),
          cleanResponseLength: 0
        });
      }
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
        errorCode: validated.errorCode,
        suggestedReply: generation.text,
        suggestionSource: "model",
        liveModel: generation.model,
        liveProvider: generation.provider,
        livePromptTokens: generation.promptTokens ?? null,
        liveCompletionTokens: generation.completionTokens ?? null,
        liveTotalTokens: generation.totalTokens ?? null,
        liveLatencyMs: generation.latencyMs,
        contextMessageCount: generation.contextMessageCount,
        contextHash: generation.contextHash,
        generatedAt: new Date()
      });
      return;
    }

    await mergeAiAgentLiveLogMetadata(logId, companyId, {
      handoffRequested: handoffSignal.handoffRequested,
      handoffReason: handoffSignal.handoffReason,
      handoffMarkerDetected: handoffSignal.handoffRequested,
      cleanResponseLength: validated.text.length
    });

    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.GENERATED,
      suggestedReply: validated.text,
      suggestionSource: "model",
      liveModel: generation.model,
      liveProvider: generation.provider,
      livePromptTokens: generation.promptTokens ?? null,
      liveCompletionTokens: generation.completionTokens ?? null,
      liveTotalTokens: generation.totalTokens ?? null,
      liveLatencyMs: generation.latencyMs,
      contextMessageCount: generation.contextMessageCount,
      contextHash: generation.contextHash,
      generatedAt: new Date(),
      errorCode: null
    });

    const sendClaimed = await claimLiveSending(logId, companyId);
    if (!sendClaimed) {
      return;
    }

    const ticketBeforeSend = await Ticket.findOne({
      where: { id: freshTicket.id, companyId }
    });
    if (!ticketBeforeSend) {
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
        sendErrorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_SEND_FAILED,
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SEND_FAILED
      });
      return;
    }

    const sendBlock = await assertTicketStillEligibleForLive(ticketBeforeSend, whatsapp);
    if (sendBlock) {
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
        errorCode: sendBlock,
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.NOT_SENT
      });
      return;
    }

    const sendResult = await sendAiAgentWhatsappMessage({
      ticket: ticketBeforeSend,
      body: validated.text,
      companyId,
      aiAgentId: agent.id,
      aiAgentRuntimeLogId: logId
    });

    if (sendResult.ok === false) {
      if (handoffSignal.handoffRequested) {
        await applyAiAgentHandoffToTicket({
          ticket: ticketBeforeSend,
          companyId,
          reason: "handoff_pending_send_failed",
          by: "ai_agent"
        });
        await mergeAiAgentLiveLogMetadata(logId, companyId, {
          handoffAppliedAt: new Date().toISOString()
        });
      }
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
        sendErrorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_SEND_FAILED,
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SEND_FAILED,
        errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_SEND_FAILED
      });
      logger.warn(
        { companyId, logId, ticketId: ticket.id, error: sendResult.error },
        "[AiAgent][live] send_failed"
      );
      return;
    }

    if (handoffSignal.handoffRequested) {
      await applyAiAgentHandoffToTicket({
        ticket: ticketBeforeSend,
        companyId,
        reason: handoffSignal.handoffReason ?? "model_requested_handoff",
        by: "ai_agent"
      });
      await mergeAiAgentLiveLogMetadata(logId, companyId, {
        handoffAppliedAt: new Date().toISOString()
      });
    }

    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.SENT,
      sentMessageId: sendResult.messageId,
      sentAt: new Date(),
      deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SENT,
      sendErrorCode: null
    });

    logger.info(
      {
        companyId,
        ticketId: ticket.id,
        logId,
        model: generation.model,
        provider: generation.provider,
        messageId: sendResult.messageId
      },
      "[AiAgent][live] response_sent"
    );
  } catch (err) {
    await updateAiAgentLiveLog(logId, companyId, {
      liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
      errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_GENERATION_FAILED,
      liveLatencyMs: Date.now() - startedAt
    });
    logger.warn(
      { err, companyId, logId, ticketId: log.ticketId },
      "[AiAgent][live] generation_failed"
    );
  } finally {
    inFlightLiveTickets.delete(log.ticketId ?? 0);
    await releaseAiAgentGenerationLock(lock.key);
  }
}

const debouncedLiveByTicket = new Map<
  number,
  { fn: ReturnType<typeof debounce>; ticketId: number }
>();

const pendingLiveByTicket = new Map<
  number,
  {
    logId: number;
    companyId: number;
    ticketId: number;
    inboundText: string;
    classification: InboundMessageClassification;
  }
>();

function ensureDebouncedLiveRunner(ticketId: number): () => void {
  const existing = debouncedLiveByTicket.get(ticketId);
  if (existing) return existing.fn;

  const fn = debounce(async () => {
    const pending = pendingLiveByTicket.get(ticketId);
    if (!pending) return;
    pendingLiveByTicket.delete(ticketId);
    await markSupersededLiveLogs(
      pending.ticketId,
      pending.companyId,
      pending.logId
    );
    await generateAndSendLiveResponseForLog(
      pending.logId,
      pending.companyId,
      pending.inboundText,
      pending.classification
    );
  }, AI_AGENT_LIVE_DEBOUNCE_MS, ticketId);

  debouncedLiveByTicket.set(ticketId, { fn, ticketId });
  return fn;
}

export function scheduleLiveResponse(input: {
  logId: number;
  companyId: number;
  ticketId: number;
  inboundText: string;
  classification: InboundMessageClassification;
}): void {
  pendingLiveByTicket.set(input.ticketId, input);
  ensureDebouncedLiveRunner(input.ticketId)();
}
