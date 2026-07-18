import AiAgentRuntimeLog from "../../models/AiAgentRuntimeLog";
import AiAgentSuggestionReview from "../../models/AiAgentSuggestionReview";
import Ticket from "../../models/Ticket";
import AiAgent from "../../models/AiAgent";
import { sanitizeAiAgentRuntimeMetadata } from "./sanitizeAiAgentRuntimeMetadata";

export type SerializedShadowSuggestion = {
  id: number;
  createdAt: Date;
  ticketId: number | null;
  ticketUuid: string | null;
  contactId: number | null;
  aiAgentId: number | null;
  aiAgentName: string | null;
  eligible: boolean;
  reason: string;
  shadowStatus: string;
  errorCode: string | null;
  suggestionSource: string | null;
  suggestedReply: string | null;
  shadowProvider: string | null;
  shadowModel: string | null;
  model: string | null;
  provider: string | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number | null;
  contextMessageCount: number | null;
  generatedAt: Date | null;
  messageType: string | null;
  hasText: boolean | null;
  hasMedia: boolean | null;
  credentialSource: string | null;
  credentialId: number | null;
  evaluatorVersion: string | null;
  liveStatus: string | null;
  deliveryStatus: string | null;
  sentMessageId: string | null;
  sentAt: Date | null;
  sendErrorCode: string | null;
  liveProvider: string | null;
  liveModel: string | null;
  liveLatencyMs: number | null;
  runtimeMode: string;
  notSentToClient: boolean;
  knowledge: Record<string, unknown> | null;
  review: SerializedShadowReview | null;
};

export type SerializedShadowReview = {
  id: number;
  rating: string;
  tags: string[];
  note: string | null;
  reviewedBy: number;
  reviewedAt: Date;
};

type RowInput = {
  log: AiAgentRuntimeLog;
  aiAgent?: AiAgent | null;
  ticket?: Ticket | null;
  review?: AiAgentSuggestionReview | null;
};

function readSafeMeta(log: AiAgentRuntimeLog): Record<string, unknown> {
  return sanitizeAiAgentRuntimeMetadata(
    (log.metadata || {}) as Record<string, unknown>
  );
}

export function serializeShadowSuggestionRow(input: RowInput): SerializedShadowSuggestion {
  const { log, aiAgent, ticket, review } = input;
  const meta = readSafeMeta(log);

  const credentialSource =
    typeof meta.credentialSource === "string" ? meta.credentialSource : null;
  const credentialId =
    typeof meta.credentialId === "number" ? meta.credentialId : null;

  return {
    id: log.id,
    createdAt: log.createdAt,
    ticketId: log.ticketId,
    ticketUuid: ticket?.uuid ?? null,
    contactId: log.contactId,
    aiAgentId: log.aiAgentId,
    aiAgentName: aiAgent?.name ?? null,
    eligible: log.eligible,
    reason: log.reason,
    shadowStatus: log.shadowStatus,
    errorCode: log.errorCode,
    suggestionSource: log.suggestionSource,
    suggestedReply: log.suggestedReply,
    shadowProvider: log.shadowProvider,
    shadowModel: log.shadowModel,
    model: log.shadowModel,
    provider: log.shadowProvider,
    promptTokens: log.promptTokens,
    completionTokens: log.completionTokens,
    totalTokens: log.totalTokens,
    latencyMs: log.latencyMs,
    contextMessageCount: log.contextMessageCount,
    generatedAt: log.generatedAt,
    messageType:
      typeof meta.messageType === "string" ? meta.messageType : null,
    hasText: typeof meta.hasText === "boolean" ? meta.hasText : null,
    hasMedia: typeof meta.hasMedia === "boolean" ? meta.hasMedia : null,
    credentialSource,
    credentialId,
    evaluatorVersion:
      typeof meta.evaluatorVersion === "string" ? meta.evaluatorVersion : null,
    liveStatus: log.liveStatus ?? null,
    deliveryStatus: log.deliveryStatus ?? "not_sent",
    sentMessageId: log.sentMessageId ?? null,
    sentAt: log.sentAt ?? null,
    sendErrorCode: log.sendErrorCode ?? null,
    liveProvider: log.liveProvider ?? null,
    liveModel: log.liveModel ?? null,
    liveLatencyMs: log.liveLatencyMs ?? null,
    runtimeMode: log.mode,
    notSentToClient:
      log.mode !== "live" || log.deliveryStatus !== "sent",
    knowledge:
      meta.knowledge && typeof meta.knowledge === "object"
        ? (meta.knowledge as Record<string, unknown>)
        : null,
    review: review
      ? {
          id: review.id,
          rating: review.rating,
          tags: Array.isArray(review.tags) ? review.tags : [],
          note: review.note,
          reviewedBy: review.reviewedBy,
          reviewedAt: review.updatedAt
        }
      : null
  };
}
