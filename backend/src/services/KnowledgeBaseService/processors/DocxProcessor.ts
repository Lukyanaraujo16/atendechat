import mammoth from "mammoth";
import AppError from "../../../errors/AppError";
import { KNOWLEDGE_PROCESSING_MAX_BYTES } from "../../../config/knowledgeBaseConstants";
import { sanitizeKnowledgeText } from "./sanitizeText";
import type {
  KnowledgeDocumentProcessor,
  ProcessorInput,
  ProcessorResult
} from "./types";

export class DocxProcessor implements KnowledgeDocumentProcessor {
  readonly name = "docx" as const;

  supports(document: ProcessorInput["document"]): boolean {
    if (document.sourceType !== "upload") return false;
    const name = (document.fileName || document.storagePath || "").toLowerCase();
    return (
      name.endsWith(".docx") ||
      document.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  }

  validate(input: ProcessorInput): void {
    if (!input.fileBuffer || input.fileBuffer.length === 0) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_EMPTY_FILE",
        400,
        "Ficheiro DOCX vazio ou inacessível."
      );
    }
    if (input.fileBuffer.length > KNOWLEDGE_PROCESSING_MAX_BYTES) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_TOO_LARGE",
        400,
        "Ficheiro excede o limite de 5 MB para processamento."
      );
    }
  }

  sanitize(text: string): string {
    return sanitizeKnowledgeText(text);
  }

  async process(input: ProcessorInput): Promise<ProcessorResult> {
    this.validate(input);
    let raw: string;
    try {
      const result = await mammoth.extractRawText({
        buffer: input.fileBuffer!
      });
      raw = String(result?.value || "");
    } catch {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_DOCX_FAILED",
        422,
        "Falha ao extrair texto do DOCX."
      );
    }

    const contentText = this.sanitize(raw);
    if (!contentText) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_EMPTY_CONTENT",
        422,
        "Não foi possível extrair texto do DOCX."
      );
    }

    return {
      processor: this.name,
      contentText,
      contentMarkdown: null,
      logs: [{ event: "extracted", chars: contentText.length }]
    };
  }
}

export default DocxProcessor;
