import { logger } from "../../utils/logger";

/**
 * Métricas sanitizadas de mídia — nunca logar base64, áudio, imagem ou transcrição completa.
 */
export type AiAgentMediaMetricEvent =
  | "ai_agent.media_received"
  | "ai_agent.audio_file_resolved"
  | "ai_agent.audio_transcription_started"
  | "ai_agent.audio_transcription_completed"
  | "ai_agent.audio_transcription_failed"
  | "ai_agent.audio_fallback_sent"
  | "ai_agent.audio_processing_completed"
  | "ai_agent.image_analysis_started"
  | "ai_agent.image_analysis_completed"
  | "ai_agent.image_analysis_failed";

export type AiAgentMediaMetricFields = {
  companyId?: number;
  agentId?: number | null;
  ticketId?: number | null;
  messageId?: string | null;
  provider?: string | null;
  model?: string | null;
  transcriptionModel?: string | null;
  mediaType?: string | null;
  byteSize?: number | null;
  durationMs?: number | null;
  result?: string | null;
  errorCode?: string | null;
  technicalCode?: string | null;
  normalizedMimeType?: string | null;
  detectedExtension?: string | null;
  detectedContainer?: string | null;
  magicHex?: string | null;
  httpStatus?: number | null;
  providerErrorCode?: string | null;
  errorStage?: string | null;
  timedOut?: boolean | null;
};

export function emitAiAgentMediaMetric(
  event: AiAgentMediaMetricEvent,
  fields: AiAgentMediaMetricFields
): void {
  try {
    logger.info(
      {
        event,
        companyId: fields.companyId ?? null,
        agentId: fields.agentId ?? null,
        ticketId: fields.ticketId ?? null,
        messageId: fields.messageId
          ? String(fields.messageId).slice(0, 64)
          : null,
        provider: fields.provider ?? null,
        model: fields.model ?? null,
        transcriptionModel: fields.transcriptionModel ?? null,
        mediaType: fields.mediaType ?? null,
        byteSize:
          typeof fields.byteSize === "number" &&
          Number.isFinite(fields.byteSize)
            ? fields.byteSize
            : null,
        durationMs:
          typeof fields.durationMs === "number" &&
          Number.isFinite(fields.durationMs)
            ? fields.durationMs
            : null,
        result: fields.result ?? null,
        errorCode: fields.errorCode ?? null,
        technicalCode: fields.technicalCode ?? null,
        normalizedMimeType: fields.normalizedMimeType ?? null,
        detectedExtension: fields.detectedExtension ?? null,
        detectedContainer: fields.detectedContainer ?? null,
        magicHex: fields.magicHex ?? null,
        httpStatus:
          typeof fields.httpStatus === "number" ? fields.httpStatus : null,
        providerErrorCode: fields.providerErrorCode
          ? String(fields.providerErrorCode).slice(0, 64)
          : null,
        errorStage: fields.errorStage ?? null,
        timedOut: fields.timedOut === true
      },
      `[AiAgent][media] ${event}`
    );
  } catch {
    // nunca derrubar o runtime por métrica
  }
}
