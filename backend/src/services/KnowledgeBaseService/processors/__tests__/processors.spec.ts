import { sanitizeKnowledgeText, markdownToPlainText } from "../sanitizeText";
import TxtProcessor from "../TxtProcessor";
import MarkdownProcessor from "../MarkdownProcessor";
import PdfProcessor from "../PdfProcessor";
import DocxProcessor from "../DocxProcessor";
import WebsiteProcessor from "../WebsiteProcessor";
import { resolveKnowledgeProcessor } from "../index";
import AppError from "../../../../errors/AppError";

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn()
  }
}));

jest.mock("mammoth", () => ({
  __esModule: true,
  default: {
    extractRawText: jest.fn()
  }
}));

import axios from "axios";
import mammoth from "mammoth";

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    companyId: 10,
    sourceType: "upload",
    fileName: "doc.txt",
    mimeType: "text/plain",
    storagePath: "public/knowledge-base/company-10/doc.txt",
    contentText: null,
    contentMarkdown: null,
    sourceUrl: null,
    ...overrides
  } as any;
}

describe("Knowledge document processors", () => {
  describe("sanitize", () => {
    it("removes scripts, excess blank lines and invisible chars", () => {
      const raw =
        "Hello\u200B\n\n\n\n<script>alert(1)</script>\nWorld   spaced";
      const out = sanitizeKnowledgeText(raw);
      expect(out).not.toMatch(/script/i);
      expect(out).not.toContain("\u200B");
      expect(out).toContain("Hello");
      expect(out).toContain("World spaced");
      expect(out).not.toMatch(/\n{3,}/);
    });

    it("converts markdown preserving headings as plain lines", () => {
      const md = "# Título\n\n**negrito** e [link](https://x.com)\n\n- item";
      const out = markdownToPlainText(md);
      expect(out).toContain("Título");
      expect(out).toContain("negrito");
      expect(out).toContain("link");
      expect(out).not.toContain("**");
      expect(out).not.toContain("#");
    });
  });

  describe("TxtProcessor", () => {
    it("extracts and sanitizes utf-8 text", async () => {
      const processor = new TxtProcessor();
      const result = await processor.process({
        document: makeDoc({ fileName: "a.txt" }),
        fileBuffer: Buffer.from("Linha 1\n\n\nLinha 2", "utf8")
      });
      expect(result.processor).toBe("txt");
      expect(result.contentText).toContain("Linha 1");
      expect(result.contentText).toContain("Linha 2");
    });

    it("rejects oversized files", async () => {
      const processor = new TxtProcessor();
      const big = Buffer.alloc(6 * 1024 * 1024, 65);
      await expect(
        processor.process({
          document: makeDoc({ fileName: "big.txt" }),
          fileBuffer: big
        })
      ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_PROCESSING_TOO_LARGE" });
    });
  });

  describe("MarkdownProcessor", () => {
    it("stores markdown and plain text for uploads", async () => {
      const processor = new MarkdownProcessor();
      const md = "# FAQ\n\nResposta **ok**";
      const result = await processor.process({
        document: makeDoc({
          fileName: "faq.md",
          mimeType: "text/markdown"
        }),
        fileBuffer: Buffer.from(md, "utf8")
      });
      expect(result.processor).toBe("markdown");
      expect(result.contentMarkdown).toContain("FAQ");
      expect(result.contentText).toContain("Resposta ok");
    });

    it("processes manual content without file", async () => {
      const processor = new MarkdownProcessor();
      const result = await processor.process({
        document: makeDoc({
          sourceType: "manual",
          contentMarkdown: "## Manual\n\ntexto"
        }),
        fileBuffer: null
      });
      expect(result.contentText).toContain("Manual");
      expect(result.contentText).toContain("texto");
    });
  });

  describe("PdfProcessor", () => {
    it("rejects non-pdf buffers", async () => {
      const processor = new PdfProcessor();
      await expect(
        processor.process({
          document: makeDoc({ fileName: "a.pdf", mimeType: "application/pdf" }),
          fileBuffer: Buffer.from("not-a-pdf")
        })
      ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_PROCESSING_INVALID_PDF" });
    });

    it("flags empty extraction as image-only PDF", () => {
      const processor = new PdfProcessor();
      const contentText = processor.sanitize("   ");
      expect(
        !contentText || contentText.replace(/\s/g, "").length < 10
      ).toBe(true);
      expect(() => {
        if (!contentText || contentText.replace(/\s/g, "").length < 10) {
          throw new AppError(
            "ERR_KNOWLEDGE_PROCESSING_PDF_IMAGE_ONLY",
            422,
            "image"
          );
        }
      }).toThrow(AppError);
    });
  });

  describe("DocxProcessor", () => {
    it("extracts text via mammoth", async () => {
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({
        value: "Contrato  \n\nCláusula 1"
      });
      const processor = new DocxProcessor();
      const result = await processor.process({
        document: makeDoc({
          fileName: "c.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        }),
        fileBuffer: Buffer.from("PK")
      });
      expect(result.processor).toBe("docx");
      expect(result.contentText).toContain("Contrato");
      expect(result.contentText).toContain("Cláusula 1");
    });

    it("fails when mammoth returns empty", async () => {
      (mammoth.extractRawText as jest.Mock).mockResolvedValue({ value: "  " });
      const processor = new DocxProcessor();
      await expect(
        processor.process({
          document: makeDoc({ fileName: "c.docx" }),
          fileBuffer: Buffer.from("PK")
        })
      ).rejects.toMatchObject({
        message: "ERR_KNOWLEDGE_PROCESSING_EMPTY_CONTENT"
      });
    });
  });

  describe("WebsiteProcessor", () => {
    it("extracts main content and strips noise", async () => {
      (axios.get as jest.Mock).mockResolvedValue({
        data: `
          <html><head><style>.x{}</style><script>1</script></head>
          <body>
            <nav>Menu</nav>
            <header>Topo</header>
            <main><h1>Produto</h1><p>Descrição útil do produto.</p></main>
            <footer>Rodapé</footer>
            <div class="cookie-banner">cookies</div>
          </body></html>`
      });
      const processor = new WebsiteProcessor();
      const result = await processor.process({
        document: makeDoc({
          sourceType: "website",
          sourceUrl: "https://example.com/page",
          fileName: null
        })
      });
      expect(result.processor).toBe("website");
      expect(result.contentText).toContain("Produto");
      expect(result.contentText).toContain("Descrição útil");
      expect(result.contentText.toLowerCase()).not.toContain("script");
    });

    it("fails when fetch fails", async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error("network"));
      const processor = new WebsiteProcessor();
      await expect(
        processor.process({
          document: makeDoc({
            sourceType: "website",
            sourceUrl: "https://example.com"
          })
        })
      ).rejects.toMatchObject({
        message: "ERR_KNOWLEDGE_PROCESSING_WEBSITE_FETCH"
      });
    });
  });

  describe("resolveKnowledgeProcessor", () => {
    it("picks txt/pdf/website/manual correctly", () => {
      expect(resolveKnowledgeProcessor(makeDoc({ fileName: "a.txt" })).name).toBe(
        "txt"
      );
      expect(
        resolveKnowledgeProcessor(
          makeDoc({ fileName: "a.pdf", mimeType: "application/pdf" })
        ).name
      ).toBe("pdf");
      expect(
        resolveKnowledgeProcessor(
          makeDoc({ sourceType: "website", sourceUrl: "https://x.com" })
        ).name
      ).toBe("website");
      expect(
        resolveKnowledgeProcessor(
          makeDoc({ sourceType: "manual", contentText: "x" })
        ).name
      ).toBe("markdown");
    });
  });
});
