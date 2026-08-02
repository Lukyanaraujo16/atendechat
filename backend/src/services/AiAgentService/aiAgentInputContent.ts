/**
 * Contrato normalizado de entrada multimodal do AI Agent (Fase 2.17).
 * Texto + anexos tipados; sem secrets; sem URLs públicas permanentes.
 */

export type AiAgentAttachmentType = "image" | "audio" | "document" | "video";

export type AiAgentAttachmentSource =
  | {
      kind: "local_path";
      /** Caminho absoluto já validado sob public/ */
      absolutePath: string;
    }
  | {
      kind: "buffer";
      data: Buffer;
    };

export type AiAgentInputAttachment = {
  type: AiAgentAttachmentType;
  mimeType: string;
  filename?: string;
  source: AiAgentAttachmentSource;
  caption?: string;
  byteSize?: number;
  messageId?: string;
};

export type AiAgentInputContent = {
  text?: string;
  attachments?: AiAgentInputAttachment[];
};

export type AiAgentPreparedImagePart = {
  mimeType: string;
  /** Base64 sem prefixo data: — nunca logar. */
  base64: string;
  byteSize: number;
};

export type AiAgentPreparedMultimodalTurn = {
  /** Texto efetivo do turno (caption + transcrição). */
  inboundText: string;
  /** Marcador interno do tipo original (não é instrução de sistema). */
  originalMediaType: AiAgentAttachmentType | "text" | "unknown";
  transcription?: string | null;
  imageParts: AiAgentPreparedImagePart[];
  /** Metadados sanitizados para logs/metrics. */
  mediaMeta: {
    mediaType?: string;
    byteSize?: number;
    imageCount?: number;
    transcribed?: boolean;
    transcriptionChars?: number;
  };
};

export const AI_AGENT_AUDIO_FALLBACK_MESSAGE =
  "Não consegui compreender bem o áudio. Você pode enviá-lo novamente ou escrever a mensagem?";

export const AI_AGENT_IMAGE_FALLBACK_MESSAGE =
  "Não consegui visualizar essa imagem com clareza. Você pode enviá-la novamente ou me contar o que precisa verificar?";

export const AI_AGENT_VISION_UNSUPPORTED_MESSAGE =
  "Recebi sua imagem, mas este agente ainda não está configurado para analisar fotos. Você pode descrever o que precisa ou ajustar o modelo nas configurações.";
