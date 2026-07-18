import AppError from "../../../errors/AppError";
import type AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import DocxProcessor from "./DocxProcessor";
import MarkdownProcessor from "./MarkdownProcessor";
import PdfProcessor from "./PdfProcessor";
import TxtProcessor from "./TxtProcessor";
import WebsiteProcessor from "./WebsiteProcessor";
import type { KnowledgeDocumentProcessor } from "./types";

const PROCESSORS: KnowledgeDocumentProcessor[] = [
  new WebsiteProcessor(),
  new PdfProcessor(),
  new DocxProcessor(),
  new MarkdownProcessor(),
  new TxtProcessor()
];

/**
 * Resolve o processador adequado ao documento.
 * Manual sem ficheiro usa MarkdownProcessor (conteúdo já no DB).
 */
export function resolveKnowledgeProcessor(
  document: AiKnowledgeDocument
): KnowledgeDocumentProcessor {
  if (document.sourceType === "manual") {
    return new MarkdownProcessor();
  }

  const match = PROCESSORS.find(p => p.supports(document));
  if (!match) {
    throw new AppError(
      "ERR_KNOWLEDGE_PROCESSING_UNSUPPORTED",
      400,
      "Tipo de documento sem processador suportado nesta fase."
    );
  }
  return match;
}

export {
  DocxProcessor,
  MarkdownProcessor,
  PdfProcessor,
  TxtProcessor,
  WebsiteProcessor
};
