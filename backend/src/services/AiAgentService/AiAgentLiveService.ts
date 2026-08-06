import AiAgent from "../../models/AiAgent";
import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import { debounce } from "../../helpers/Debounce";
import { logger } from "../../utils/logger";
import { AI_AGENT_LIVE_DEBOUNCE_MS } from "./aiAgentLiveConfig";
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
import executeAiAgentHandoffWithTransition from "./executeAiAgentHandoffWithTransition";
import { maybeApplySafetyHandoffForLiveBlock } from "./maybeApplySafetyHandoffForLiveBlock";
import { loadAiAgentProfileForRuntime } from "./resolveAiAgentBusinessPrompt";
import { sanitizeAiAgentClientFacingText } from "./buildAiAgentHandoffTransitionMessage";
import {
  acquireAiAgentGenerationLock,
  releaseAiAgentGenerationLock
} from "./knowledge/aiAgentGenerationLock";
import { generateLiveResponseWithOptionalFc } from "../AutomationOrchestrator/liveRollout/LiveFunctionCallingService";
import {
  isMultimodalInboundCandidate,
  mediaTypeHintFromClassification,
  prepareAiAgentMultimodalTurn
} from "./prepareAiAgentMultimodalTurn";
import { resolveAiAgentOpenAiApiKeyWithSource } from "./resolveAiAgentApiCredential";
import { parseAiAgentModelForProvider } from "./aiAgentValidation";
import { AI_AGENT_SHADOW_ERROR_CODES } from "./aiAgentShadowErrors";
import { emitAiAgentMediaMetric } from "./emitAiAgentMediaMetric";
import { startAiAgentTypingPresence } from "./startAiAgentTypingPresence";
import { applyAiAgentLivePacing } from "./applyAiAgentLivePacing";
import {
  AI_AGENT_IMAGE_FALLBACK_MESSAGE,
  AI_AGENT_VISION_UNSUPPORTED_MESSAGE
} from "./aiAgentInputContent";
import { resolveAiModelMediaCapabilities } from "../../config/aiModelMediaCapabilities";

const inFlightLiveTickets = new Set<number>();

function mapMediaPrepareError(errorCode: string): string {
  switch (errorCode) {
    case "vision_not_supported":
      return AI_AGENT_SHADOW_ERROR_CODES.VISION_NOT_SUPPORTED;
    case "file_too_large":
      return AI_AGENT_SHADOW_ERROR_CODES.MEDIA_TOO_LARGE;
    case "format_unsupported":
      return AI_AGENT_SHADOW_ERROR_CODES.MEDIA_FORMAT_UNSUPPORTED;
    case "media_unavailable":
      return AI_AGENT_SHADOW_ERROR_CODES.MEDIA_UNAVAILABLE;
    case "empty_transcription":
    case "timeout":
    case "provider_unavailable":
    case "credential_missing":
    case "lock_busy":
    case "model_incompatible":
      return AI_AGENT_SHADOW_ERROR_CODES.AUDIO_TRANSCRIPTION_FAILED;
    default:
      return AI_AGENT_SHADOW_ERROR_CODES.MEDIA_UNAVAILABLE;
  }
}

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
  if (
    !classification.hasText &&
    !isMultimodalInboundCandidate(classification)
  ) {
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
      errorCode: limits.errorCode,
      agent,
      aiAgentRuntimeLogId: logId
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
  const executionId = `live-${companyId}-${logId}-${startedAt}`;

  const typing = await startAiAgentTypingPresence({
    ticket,
    whatsapp,
    contact,
    companyId,
    agentId: agent.id,
    executionId
  });

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

    const freshBlock = await assertTicketStillEligibleForLive(
      freshTicket,
      whatsapp
    );
    if (freshBlock) {
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
        errorCode: freshBlock
      });
      return;
    }

    const pacingCtx = {
      processingStartedAtMs: startedAt,
      companyId,
      ticketId: freshTicket.id,
      agentId: agent.id,
      whatsappId: whatsapp.id,
      executionId
    };

    const resolvedCred = await resolveAiAgentOpenAiApiKeyWithSource({
      companyId,
      whatsapp,
      ticket: freshTicket,
      agent
    });

    let effectiveInboundText = inboundText;
    let knowledgeQuery = inboundText;
    let imageParts: Array<{ mimeType: string; base64: string }> = [];

    if (
      resolvedCred.apiKey &&
      resolvedCred.provider &&
      (isMultimodalInboundCandidate(classification) || classification.hasMedia)
    ) {
      let modelForCaps = String(agent.model || "");
      try {
        modelForCaps = parseAiAgentModelForProvider(
          agent.model,
          resolvedCred.provider
        );
      } catch {
        // usa model bruto para capability check
      }

      const prepared = await prepareAiAgentMultimodalTurn({
        companyId,
        ticketId: freshTicket.id,
        agentId: agent.id,
        messageId: log.messageId || null,
        inboundText,
        classification,
        provider: resolvedCred.provider,
        apiKey: resolvedCred.apiKey,
        model: modelForCaps
      });

      if (prepared.ok === false) {
        await mergeAiAgentLiveLogMetadata(logId, companyId, {
          mediaErrorCode: prepared.errorCode,
          mediaAskRetry: prepared.askRetry,
          mediaType: classification.messageType,
          mediaTechnicalCode: prepared.technicalCode || null
        });

        // claimLiveSending exige liveStatus=GENERATED (máquina de estados).
        // Sem este update o fallback de mídia nunca sai do QUEUED → cliente
        // fica sem resposta após timeout de transcrição (sintoma 2.20).
        await updateAiAgentLiveLog(logId, companyId, {
          liveStatus: AI_AGENT_LIVE_STATUSES.GENERATED,
          suggestedReply: prepared.clientFallbackMessage,
          suggestionSource: "media_fallback",
          errorCode: mapMediaPrepareError(prepared.errorCode),
          generatedAt: new Date()
        });

        const claimedSend = await claimLiveSending(logId, companyId);
        if (!claimedSend) {
          return;
        }

        await applyAiAgentLivePacing({
          ...pacingCtx,
          responseText: prepared.clientFallbackMessage,
          kind: "fallback"
        });

        const sendFallback = await sendAiAgentWhatsappMessage({
          ticket: freshTicket,
          body: prepared.clientFallbackMessage,
          companyId,
          aiAgentId: agent.id,
          aiAgentRuntimeLogId: logId,
          agentName: agent.name
        });

        if (sendFallback.ok === false) {
          await updateAiAgentLiveLog(logId, companyId, {
            liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
            errorCode: mapMediaPrepareError(prepared.errorCode),
            sendErrorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_SEND_FAILED,
            deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SEND_FAILED
          });
          return;
        }

        emitAiAgentMediaMetric("ai_agent.audio_fallback_sent", {
          companyId,
          agentId: agent.id,
          ticketId: freshTicket.id,
          messageId: log.messageId,
          provider: resolvedCred.provider,
          mediaType: classification.messageType,
          errorCode: prepared.errorCode,
          result: "sent"
        });

        await updateAiAgentLiveLog(logId, companyId, {
          liveStatus: AI_AGENT_LIVE_STATUSES.SENT,
          sentMessageId: sendFallback.messageId,
          sentAt: new Date(),
          deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SENT,
          sendErrorCode: null,
          suggestedReply: prepared.clientFallbackMessage,
          suggestionSource: "media_fallback",
          errorCode: mapMediaPrepareError(prepared.errorCode)
        });
        return;
      }

      effectiveInboundText = prepared.turn.inboundText;
      knowledgeQuery = prepared.knowledgeQuery;
      imageParts = prepared.turn.imageParts.map(p => ({
        mimeType: p.mimeType,
        base64: p.base64
      }));

      await mergeAiAgentLiveLogMetadata(logId, companyId, {
        mediaType:
          prepared.turn.mediaMeta.mediaType || classification.messageType,
        mediaByteSize: prepared.turn.mediaMeta.byteSize ?? null,
        mediaImageCount: prepared.turn.mediaMeta.imageCount ?? null,
        mediaTranscribed: prepared.turn.mediaMeta.transcribed === true,
        mediaTranscriptionChars:
          prepared.turn.mediaMeta.transcriptionChars ?? null
      });

      if (imageParts.length > 0) {
        emitAiAgentMediaMetric("ai_agent.image_analysis_started", {
          companyId,
          agentId: agent.id,
          ticketId: freshTicket.id,
          messageId: log.messageId,
          provider: resolvedCred.provider,
          model: modelForCaps,
          mediaType: "image",
          byteSize: prepared.turn.mediaMeta.byteSize
        });
      }
    }

    // Fail-closed: imagem sem bytes reais nunca chama o modelo text-only.
    if (classification.messageType === "image" && imageParts.length === 0) {
      let modelForCapsGuard = String(agent.model || "");
      try {
        if (resolvedCred.provider) {
          modelForCapsGuard = parseAiAgentModelForProvider(
            agent.model,
            resolvedCred.provider
          );
        }
      } catch {
        // model bruto
      }
      const caps = resolveAiModelMediaCapabilities(
        resolvedCred.provider,
        modelForCapsGuard
      );
      const guardErrorCode = caps.supportsVision
        ? "media_unavailable"
        : "vision_not_supported";
      const clientFallbackMessage = caps.supportsVision
        ? AI_AGENT_IMAGE_FALLBACK_MESSAGE
        : AI_AGENT_VISION_UNSUPPORTED_MESSAGE;

      await mergeAiAgentLiveLogMetadata(logId, companyId, {
        mediaErrorCode: guardErrorCode,
        mediaAskRetry: caps.supportsVision,
        mediaType: "image",
        mediaImageCount: 0,
        mediaTechnicalCode: "image_parts_empty_fail_closed"
      });

      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.GENERATED,
        suggestedReply: clientFallbackMessage,
        suggestionSource: "media_fallback",
        errorCode: mapMediaPrepareError(guardErrorCode),
        generatedAt: new Date()
      });

      const claimedSendGuard = await claimLiveSending(logId, companyId);
      if (!claimedSendGuard) {
        return;
      }

      await applyAiAgentLivePacing({
        ...pacingCtx,
        responseText: clientFallbackMessage,
        kind: "fallback"
      });

      const sendGuard = await sendAiAgentWhatsappMessage({
        ticket: freshTicket,
        body: clientFallbackMessage,
        companyId,
        aiAgentId: agent.id,
        aiAgentRuntimeLogId: logId,
        agentName: agent.name
      });

      if (sendGuard.ok === false) {
        await updateAiAgentLiveLog(logId, companyId, {
          liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
          errorCode: mapMediaPrepareError(guardErrorCode),
          sendErrorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_SEND_FAILED,
          deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SEND_FAILED
        });
        return;
      }

      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.SENT,
        sentMessageId: sendGuard.messageId,
        sentAt: new Date(),
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SENT,
        sendErrorCode: null,
        suggestedReply: clientFallbackMessage,
        suggestionSource: "media_fallback",
        errorCode: mapMediaPrepareError(guardErrorCode)
      });
      return;
    }

    const generation = await generateLiveResponseWithOptionalFc({
      companyId,
      ticket: freshTicket,
      contact,
      whatsapp,
      agent,
      inboundText: effectiveInboundText,
      knowledgeQuery,
      imageParts,
      logId,
      messageId: log.messageId || null,
      messageHints: {
        fromMe: false,
        mediaType: mediaTypeHintFromClassification(classification),
        ticketStatus: freshTicket.status,
        userId: freshTicket.userId ?? null
      }
    });

    if (imageParts.length > 0) {
      emitAiAgentMediaMetric(
        generation.ok
          ? "ai_agent.image_analysis_completed"
          : "ai_agent.image_analysis_failed",
        {
          companyId,
          agentId: agent.id,
          ticketId: freshTicket.id,
          messageId: log.messageId,
          provider: generation.provider || resolvedCred.provider,
          model: generation.model || null,
          mediaType: "image",
          durationMs: generation.latencyMs,
          result: generation.ok ? "ok" : "failed",
          errorCode:
            generation.ok === false ? generation.errorCode || null : null
        }
      );
    }

    await mergeAiAgentLiveLogMetadata(logId, companyId, {
      credentialSource: generation.credentialSource ?? "missing",
      credentialId: generation.credentialId ?? null,
      ...(generation.knowledgeMeta || {}),
      liveFc: generation.liveFcMeta || null,
      usedFunctionCalling: generation.usedFunctionCalling === true,
      liveFcFallback: generation.fallback === true,
      liveFcFallbackReason: generation.fallbackReason || null
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

    // Adaptar shape esperado pelo fluxo restante (mesmos campos de buildAiAgentProviderResponse)
    const generationAdapted = {
      ok: true as const,
      text: generation.text || "",
      model: generation.model || "unknown",
      provider: generation.provider || "unknown",
      promptTokens: generation.promptTokens,
      completionTokens: generation.completionTokens,
      totalTokens: generation.totalTokens,
      latencyMs: generation.latencyMs,
      contextMessageCount: generation.contextMessageCount || 0,
      contextHash: generation.contextHash || "",
      credentialSource: generation.credentialSource || "missing",
      credentialId: generation.credentialId ?? null,
      knowledgeMeta: generation.knowledgeMeta,
      forceHandoff: generation.forceHandoff
    };

    const handoffSignal = parseAiAgentHandoffSignal(generationAdapted.text);
    if (generationAdapted.forceHandoff && !handoffSignal.handoffRequested) {
      handoffSignal.handoffRequested = true;
      handoffSignal.handoffReason =
        handoffSignal.handoffReason || "knowledge_missing";
    }

    const profile = await loadAiAgentProfileForRuntime({
      companyId,
      aiAgentId: agent.id
    });
    const tone = profile?.tone || "professional";

    const validated = validateAiAgentLiveResponse(
      sanitizeAiAgentClientFacingText(handoffSignal.cleanText)
    );

    // Handoff com resposta inválida/vazia: envia transição obrigatória antes;
    // nunca transferir silenciosamente.
    if (validated.ok === false) {
      if (handoffSignal.handoffRequested) {
        const sendClaimedForHandoff = await claimLiveSending(logId, companyId);
        if (sendClaimedForHandoff) {
          await applyAiAgentLivePacing({
            ...pacingCtx,
            responseText: agent.handoffMessage || "transferência",
            kind: "handoff"
          });
          const handoffResult = await executeAiAgentHandoffWithTransition({
            ticket: freshTicket,
            companyId,
            aiAgentId: agent.id,
            agentName: agent.name,
            aiAgentRuntimeLogId: logId,
            reason: handoffSignal.handoffReason ?? "model_requested_handoff",
            configuredHandoffMessage: agent.handoffMessage,
            tone,
            modelCleanText: null,
            by: "ai_agent"
          });
          await mergeAiAgentLiveLogMetadata(logId, companyId, {
            handoffRequested: true,
            handoffReason: handoffSignal.handoffReason,
            handoffMarkerDetected: true,
            handoffTransitionSent: handoffResult.transitionSent,
            handoffBlocked: handoffResult.ok === false,
            handoffAppliedAt:
              handoffResult.ok === true ? new Date().toISOString() : null,
            cleanResponseLength: 0
          });
          if (handoffResult.ok) {
            await updateAiAgentLiveLog(logId, companyId, {
              liveStatus: AI_AGENT_LIVE_STATUSES.SENT,
              suggestedReply: handoffResult.transitionBody,
              suggestionSource: "handoff_transition",
              sentMessageId: handoffResult.messageId,
              sentAt: new Date(),
              deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SENT,
              liveModel: generationAdapted.model,
              liveProvider: generationAdapted.provider,
              liveLatencyMs: generationAdapted.latencyMs,
              generatedAt: new Date(),
              errorCode: null
            });
            return;
          }
        }
      }
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
        errorCode: validated.errorCode,
        suggestedReply: generationAdapted.text,
        suggestionSource: "model",
        liveModel: generationAdapted.model,
        liveProvider: generationAdapted.provider,
        livePromptTokens: generationAdapted.promptTokens ?? null,
        liveCompletionTokens: generationAdapted.completionTokens ?? null,
        liveTotalTokens: generationAdapted.totalTokens ?? null,
        liveLatencyMs: generationAdapted.latencyMs,
        contextMessageCount: generationAdapted.contextMessageCount,
        contextHash: generationAdapted.contextHash,
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
      liveModel: generationAdapted.model,
      liveProvider: generationAdapted.provider,
      livePromptTokens: generationAdapted.promptTokens ?? null,
      liveCompletionTokens: generationAdapted.completionTokens ?? null,
      liveTotalTokens: generationAdapted.totalTokens ?? null,
      liveLatencyMs: generationAdapted.latencyMs,
      contextMessageCount: generationAdapted.contextMessageCount,
      contextHash: generationAdapted.contextHash,
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

    const sendBlock = await assertTicketStillEligibleForLive(
      ticketBeforeSend,
      whatsapp
    );
    if (sendBlock) {
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.SKIPPED,
        errorCode: sendBlock,
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.NOT_SENT
      });
      return;
    }

    // Handoff com resposta válida: a própria resposta (sanitizada) é a transição.
    if (handoffSignal.handoffRequested) {
      await applyAiAgentLivePacing({
        ...pacingCtx,
        responseText: validated.text,
        kind: "handoff"
      });
      const handoffResult = await executeAiAgentHandoffWithTransition({
        ticket: ticketBeforeSend,
        companyId,
        aiAgentId: agent.id,
        agentName: agent.name,
        aiAgentRuntimeLogId: logId,
        reason: handoffSignal.handoffReason ?? "model_requested_handoff",
        configuredHandoffMessage: agent.handoffMessage,
        tone,
        modelCleanText: validated.text,
        by: "ai_agent"
      });
      await mergeAiAgentLiveLogMetadata(logId, companyId, {
        handoffTransitionSent: handoffResult.transitionSent,
        handoffBlocked: handoffResult.ok === false,
        handoffAppliedAt:
          handoffResult.ok === true ? new Date().toISOString() : null
      });
      if (handoffResult.ok === false) {
        await updateAiAgentLiveLog(logId, companyId, {
          liveStatus: AI_AGENT_LIVE_STATUSES.FAILED,
          sendErrorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_SEND_FAILED,
          deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SEND_FAILED,
          errorCode: AI_AGENT_LIVE_ERROR_CODES.LIVE_SEND_FAILED
        });
        logger.warn(
          {
            companyId,
            logId,
            ticketId: ticket.id,
            error: handoffResult.error
          },
          "[AiAgent][live] handoff_transition_failed"
        );
        return;
      }
      await updateAiAgentLiveLog(logId, companyId, {
        liveStatus: AI_AGENT_LIVE_STATUSES.SENT,
        sentMessageId: handoffResult.messageId,
        sentAt: new Date(),
        deliveryStatus: AI_AGENT_LIVE_DELIVERY_STATUSES.SENT,
        sendErrorCode: null,
        suggestedReply: handoffResult.transitionBody
      });
      logger.info(
        {
          companyId,
          ticketId: ticket.id,
          logId,
          model: generationAdapted.model,
          provider: generationAdapted.provider,
          messageId: handoffResult.messageId,
          usedFunctionCalling: generation.usedFunctionCalling === true,
          fallback: generation.fallback === true
        },
        "[AiAgent][live] handoff_transition_sent"
      );
      return;
    }

    await applyAiAgentLivePacing({
      ...pacingCtx,
      responseText: validated.text,
      kind: "normal"
    });

    const sendResult = await sendAiAgentWhatsappMessage({
      ticket: ticketBeforeSend,
      body: validated.text,
      companyId,
      aiAgentId: agent.id,
      aiAgentRuntimeLogId: logId,
      agentName: agent.name
    });

    if (sendResult.ok === false) {
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
        model: generationAdapted.model,
        provider: generationAdapted.provider,
        messageId: sendResult.messageId,
        usedFunctionCalling: generation.usedFunctionCalling === true,
        fallback: generation.fallback === true
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
    await typing.stop("live_finished");
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

  const fn = debounce(
    async () => {
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
    },
    AI_AGENT_LIVE_DEBOUNCE_MS,
    ticketId
  );

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
