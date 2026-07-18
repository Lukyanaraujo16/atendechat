import AppError from "../../../errors/AppError";
import { KNOWLEDGE_PROCESSING_MAX_BYTES } from "../../../config/knowledgeBaseConstants";
import { markdownToPlainText, sanitizeKnowledgeText } from "./sanitizeText";
import type {
  KnowledgeDocumentProcessor,
  ProcessorInput,
  ProcessorResult
} from "./types";

export class MarkdownProcessor implements KnowledgeDocumentProcessor {
  readonly name = "markdown" as const;

  supports(document: ProcessorInput["document"]): boolean {
    if (document.sourceType === "manual") {
      return Boolean(document.contentMarkdown || document.contentText);
    }
    if (document.sourceType !== "upload") return false;
    const name = (document.fileName || document.storagePath || "").toLowerCase();
    return (
      name.endsWith(".md") ||
      name.endsWith(".markdown") ||
      document.mimeType === "text/markdown"
    );
  }

  validate(input: ProcessorInput): void {
    if (input.document.sourceType === "manual") {
      if (!input.document.contentMarkdown && !input.document.contentText) {
        throw new AppError(
          "ERR_KNOWLEDGE_PROCESSING_EMPTY_CONTENT",
          400,
          "Documento manual sem conteúdo para processar."
        );
      }
      return;
    }
    if (!input.fileBuffer || input.fileBuffer.length === 0) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_EMPTY_FILE",
        400,
        "Ficheiro Markdown vazio ou inacessível."
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

    let contentMarkdown: string;
    if (input.document.sourceType === "manual") {
      contentMarkdown =
        input.document.contentMarkdown ||
        input.document.contentText ||
        "";
    } else {
      contentMarkdown = input.fileBuffer!.toString("utf8");
    }

    contentMarkdown = contentMarkdown.replace(/^\uFEFF/, "");
    const contentText = markdownToPlainText(contentMarkdown);

    if (!contentText) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_EMPTY_CONTENT",
        422,
        "Não foi possível extrair texto do Markdown."
      );
    }

    return {
      processor: this.name,
      contentMarkdown: this.sanitize(contentMarkdown),
      contentText,
      logs: [
        {
          event: "extracted",
          markdownChars: contentMarkdown.length,
          textChars: contentText.length
        }
      ]
    };
  }
}

export default MarkdownProcessor;
