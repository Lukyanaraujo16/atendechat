import axios from "axios";
import * as cheerio from "cheerio";
import AppError from "../../../errors/AppError";
import { KNOWLEDGE_PROCESSING_MAX_BYTES } from "../../../config/knowledgeBaseConstants";
import { sanitizeKnowledgeText } from "./sanitizeText";
import type {
  KnowledgeDocumentProcessor,
  ProcessorInput,
  ProcessorResult
} from "./types";

const STRIP_TAGS = [
  "script",
  "style",
  "svg",
  "noscript",
  "iframe",
  "canvas",
  "header",
  "footer",
  "nav",
  "aside",
  "form",
  "button"
];

const NOISE_SELECTORS = [
  "[class*='cookie' i]",
  "[id*='cookie' i]",
  "[class*='banner' i]",
  "[id*='banner' i]",
  "[class*='newsletter' i]",
  "[class*='menu' i]",
  "[id*='menu' i]",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[aria-hidden='true']"
];

export class WebsiteProcessor implements KnowledgeDocumentProcessor {
  readonly name = "website" as const;

  supports(document: ProcessorInput["document"]): boolean {
    return document.sourceType === "website" && Boolean(document.sourceUrl);
  }

  validate(input: ProcessorInput): void {
    if (!input.document.sourceUrl) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "URL do website é obrigatória."
      );
    }
  }

  sanitize(text: string): string {
    return sanitizeKnowledgeText(text);
  }

  async process(input: ProcessorInput): Promise<ProcessorResult> {
    this.validate(input);
    const url = input.document.sourceUrl!;

    let html: string;
    try {
      const response = await axios.get<string>(url, {
        timeout: 30_000,
        maxContentLength: KNOWLEDGE_PROCESSING_MAX_BYTES,
        maxBodyLength: KNOWLEDGE_PROCESSING_MAX_BYTES,
        responseType: "text",
        headers: {
          "User-Agent":
            "AtendeChat-KnowledgeBase/1.5.2B (+https://atendechat.local)",
          Accept: "text/html,application/xhtml+xml"
        },
        validateStatus: status => status >= 200 && status < 400
      });
      html = String(response.data || "");
    } catch {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_WEBSITE_FETCH",
        422,
        "Não foi possível descarregar a página. Verifique a URL e tente novamente."
      );
    }

    if (!html.trim()) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_EMPTY_CONTENT",
        422,
        "Página sem conteúdo HTML."
      );
    }

    if (Buffer.byteLength(html, "utf8") > KNOWLEDGE_PROCESSING_MAX_BYTES) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_TOO_LARGE",
        400,
        "Conteúdo da página excede o limite de 5 MB para processamento."
      );
    }

    const $ = cheerio.load(html);
    for (const tag of STRIP_TAGS) {
      $(tag).remove();
    }
    for (const sel of NOISE_SELECTORS) {
      try {
        $(sel).remove();
      } catch {
        // selector incompatível — ignorar
      }
    }

    const main =
      $("main").first().text() ||
      $("article").first().text() ||
      $("[role='main']").first().text() ||
      $("body").text() ||
      "";

    const contentText = this.sanitize(main);
    if (!contentText || contentText.replace(/\s/g, "").length < 20) {
      throw new AppError(
        "ERR_KNOWLEDGE_PROCESSING_EMPTY_CONTENT",
        422,
        "Não foi possível extrair conteúdo principal da página."
      );
    }

    return {
      processor: this.name,
      contentText,
      contentMarkdown: null,
      logs: [
        {
          event: "extracted",
          url,
          chars: contentText.length
        }
      ]
    };
  }
}

export default WebsiteProcessor;
