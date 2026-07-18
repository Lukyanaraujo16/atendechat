import type { KnowledgeProcessorName } from "../../../config/knowledgeBaseConstants";
import type AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";

export type ProcessorInput = {
  document: AiKnowledgeDocument;
  /** Conteúdo do ficheiro em disco (quando aplicável). */
  fileBuffer?: Buffer | null;
  /** Absolute path do ficheiro (quando aplicável). */
  absolutePath?: string | null;
};

export type ProcessorResult = {
  processor: KnowledgeProcessorName;
  contentText: string;
  contentMarkdown?: string | null;
  logs?: Record<string, unknown>[];
};

/**
 * Interface comum de processadores.
 * Devolvem apenas texto limpo — ChunkBuilder / EmbeddingGenerator virão na 1.5.2C.
 */
export interface KnowledgeDocumentProcessor {
  readonly name: KnowledgeProcessorName;
  supports(document: AiKnowledgeDocument): boolean;
  validate(input: ProcessorInput): void | Promise<void>;
  sanitize(text: string): string;
  process(input: ProcessorInput): Promise<ProcessorResult>;
}
