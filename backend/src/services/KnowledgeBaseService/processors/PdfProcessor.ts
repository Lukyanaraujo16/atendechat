import AppError from "../../../errors/AppError";
import { KNOWLEDGE_PROCESSING_MAX_BYTES } from "../../../config/knowledgeBaseConstants";
import { sanitizeKnowledgeText } from "./sanitizeText";
import type {
  KnowledgeDocumentProcessor,
  ProcessorInput,
  ProcessorResult
} from "./types";

async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pdfParse = require("pdf-parse") as (
    data: Buffer
  ) => Promise<{ text?: string; numpages?: number }>;
  const result = await pdfParse(buffer);
  return String(result?.text || "");
}

export class PdfProcessor implements KnowledgeDocumentProcessor {
  readonly name = "pdf" as const;

  supports(document: ProcessorInput["document"]): boolean {
    if (document.sourceType !== "upload") return false;
    const name = (document.fileName || document.storagePath || "").toLowerCase();
    return name.endsWith(".pdf") || document.mimeType === "application/pdf";
  }

  validate(input: ProcessorInput): void {
    if (!input.fileBuffer || input.fileBuffer.length === 0) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_EMPTY_FILE",
        400,
        "Ficheiro PDF vazio ou inacessível."
      );
    }
    if (input.fileBuffer.length > KNOWLEDGE_PROCESSING_MAX_BYTES) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_TOO_LARGE",
        400,
        "Ficheiro excede o limite de 5 MB para processamento."
      );
    }
    const header = input.fileBuffer.slice(0, 5).toString("utf8");
    if (!header.startsWith("%PDF")) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_INVALID_PDF",
        400,
        "Ficheiro PDF inválido."
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
      raw = await extractPdfText(input.fileBuffer!);
    } catch {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_PDF_FAILED",
        422,
        "Falha ao extrair texto do PDF."
      );
    }

    const contentText = this.sanitize(raw);
    if (!contentText || contentText.replace(/\s/g, "").length < 10) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_PDF_IMAGE_ONLY",
        422,
        "Este PDF parece ser baseado em imagens. OCR não está disponível nesta fase — envie um PDF com texto selecionável."
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

export default PdfProcessor;
