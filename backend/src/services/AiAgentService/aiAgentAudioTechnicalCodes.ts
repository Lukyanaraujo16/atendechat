/**
 * Códigos técnicos internos de falha/sucesso de áudio (Fase 2.20.1).
 * O cliente continua recebendo mensagem comercial; logs/testes usam estes códigos.
 */
export const AI_AGENT_AUDIO_TECHNICAL_CODES = {
  FILE_MISSING: "audio_file_missing",
  FILE_EMPTY: "audio_file_empty",
  PATH_INVALID: "audio_path_invalid",
  FORMAT_INVALID: "audio_format_invalid",
  PROVIDER_CREDENTIAL_MISSING: "audio_provider_credential_missing",
  PROVIDER_AUTH_FAILED: "audio_provider_auth_failed",
  PROVIDER_REQUEST_FAILED: "audio_provider_request_failed",
  PROVIDER_TIMEOUT: "audio_provider_timeout",
  TRANSCRIPTION_EMPTY: "audio_transcription_empty",
  TRANSCRIPTION_SUCCESS: "audio_transcription_success",
  LOCK_BUSY: "audio_provider_request_failed"
} as const;

export type AiAgentAudioTechnicalCode =
  (typeof AI_AGENT_AUDIO_TECHNICAL_CODES)[keyof typeof AI_AGENT_AUDIO_TECHNICAL_CODES];

export function mapLegacyTranscribeErrorToTechnicalCode(
  errorCode: string | null | undefined
): AiAgentAudioTechnicalCode {
  switch (errorCode) {
    case "file_unavailable":
      return AI_AGENT_AUDIO_TECHNICAL_CODES.FILE_MISSING;
    case "file_too_large":
      return AI_AGENT_AUDIO_TECHNICAL_CODES.FILE_EMPTY;
    case "format_unsupported":
      return AI_AGENT_AUDIO_TECHNICAL_CODES.FORMAT_INVALID;
    case "credential_missing":
      return AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_CREDENTIAL_MISSING;
    case "timeout":
      return AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_TIMEOUT;
    case "empty_transcription":
      return AI_AGENT_AUDIO_TECHNICAL_CODES.TRANSCRIPTION_EMPTY;
    case "provider_unavailable":
    case "model_incompatible":
    case "lock_busy":
      return AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_REQUEST_FAILED;
    default:
      return AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_REQUEST_FAILED;
  }
}

export function mapHttpStatusToTechnicalCode(
  httpStatus: number | null | undefined
): AiAgentAudioTechnicalCode | null {
  if (!httpStatus) return null;
  if (httpStatus === 401 || httpStatus === 403) {
    return AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_AUTH_FAILED;
  }
  if (httpStatus === 408 || httpStatus === 504) {
    return AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_TIMEOUT;
  }
  if (httpStatus === 415 || httpStatus === 400) {
    return AI_AGENT_AUDIO_TECHNICAL_CODES.FORMAT_INVALID;
  }
  return AI_AGENT_AUDIO_TECHNICAL_CODES.PROVIDER_REQUEST_FAILED;
}
