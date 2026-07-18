jest.mock("../../../models/AiKnowledgeBase", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeDocument", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    sequelize: {
      fn: jest.fn((...args: unknown[]) => args),
      col: jest.fn((c: string) => c)
    }
  }
}));

import AiKnowledgeBase from "../../../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import CreateKnowledgeBaseService from "../CreateKnowledgeBaseService";
import DeleteKnowledgeBaseService from "../DeleteKnowledgeBaseService";
import DuplicateKnowledgeBaseService from "../DuplicateKnowledgeBaseService";
import CreateKnowledgeDocumentService from "../CreateKnowledgeDocumentService";
import UpdateKnowledgeDocumentService from "../UpdateKnowledgeDocumentService";
import DeleteKnowledgeDocumentService from "../DeleteKnowledgeDocumentService";
import DuplicateKnowledgeDocumentService from "../DuplicateKnowledgeDocumentService";
import AppError from "../../../errors/AppError";

describe("KnowledgeBaseService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a knowledge base with company isolation", async () => {
    (AiKnowledgeBase.create as jest.Mock).mockResolvedValue({
      id: 1,
      companyId: 10,
      name: "Comercial"
    });
    const row = await CreateKnowledgeBaseService({
      companyId: 10,
      userId: 5,
      body: { name: "Comercial", description: "Base comercial" }
    });
    expect(AiKnowledgeBase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 10,
        name: "Comercial",
        createdBy: 5
      })
    );
    expect(row.name).toBe("Comercial");
  });

  it("rejects empty base name", async () => {
    await expect(
      CreateKnowledgeBaseService({
        companyId: 1,
        userId: null,
        body: { name: "  " }
      })
    ).rejects.toMatchObject({ message: "ERR_VALIDATION_ERROR" });
  });

  it("blocks delete when base has documents", async () => {
    (AiKnowledgeBase.findOne as jest.Mock).mockResolvedValue({
      id: 2,
      companyId: 1,
      destroy: jest.fn()
    });
    (AiKnowledgeDocument.count as jest.Mock).mockResolvedValue(3);
    await expect(
      DeleteKnowledgeBaseService({ companyId: 1, id: 2 })
    ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_BASE_HAS_DOCUMENTS" });
  });

  it("deletes empty base", async () => {
    const destroy = jest.fn();
    (AiKnowledgeBase.findOne as jest.Mock).mockResolvedValue({
      id: 2,
      companyId: 1,
      destroy
    });
    (AiKnowledgeDocument.count as jest.Mock).mockResolvedValue(0);
    const result = await DeleteKnowledgeBaseService({ companyId: 1, id: 2 });
    expect(destroy).toHaveBeenCalled();
    expect(result.deleted).toBe(true);
  });

  it("duplicates base as disabled copy", async () => {
    (AiKnowledgeBase.findOne as jest.Mock).mockResolvedValue({
      id: 3,
      companyId: 1,
      name: "Suporte",
      description: "FAQ",
      enabled: true
    });
    (AiKnowledgeBase.create as jest.Mock).mockResolvedValue({
      id: 4,
      name: "Suporte (cópia)",
      enabled: false
    });
    const copy = await DuplicateKnowledgeBaseService({
      companyId: 1,
      id: 3,
      userId: 9
    });
    expect(AiKnowledgeBase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Suporte (cópia)",
        enabled: false,
        companyId: 1
      })
    );
    expect(copy.enabled).toBe(false);
  });

  it("creates manual document inside tenant base", async () => {
    (AiKnowledgeBase.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      companyId: 1
    });
    (AiKnowledgeDocument.create as jest.Mock).mockResolvedValue({
      id: 11,
      title: "FAQ",
      sourceType: "manual"
    });
    const doc = await CreateKnowledgeDocumentService({
      companyId: 1,
      knowledgeBaseId: 7,
      userId: 2,
      body: {
        title: "FAQ",
        sourceType: "manual",
        contentMarkdown: "# FAQ"
      }
    });
    expect(doc.sourceType).toBe("manual");
    expect(AiKnowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        knowledgeBaseId: 7,
        sourceType: "manual"
      })
    );
  });

  it("requires sourceUrl for website documents", async () => {
    (AiKnowledgeBase.findOne as jest.Mock).mockResolvedValue({
      id: 7,
      companyId: 1
    });
    await expect(
      CreateKnowledgeDocumentService({
        companyId: 1,
        knowledgeBaseId: 7,
        userId: null,
        body: { title: "Site", sourceType: "website" }
      })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects document from another company", async () => {
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue(null);
    await expect(
      UpdateKnowledgeDocumentService({
        companyId: 99,
        id: 1,
        userId: null,
        body: { title: "X" }
      })
    ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_DOCUMENT_NOT_FOUND" });
  });

  it("duplicates document as draft without file metadata", async () => {
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 5,
      companyId: 1,
      knowledgeBaseId: 2,
      title: "Preços",
      description: null,
      documentType: "price_table",
      sourceType: "upload",
      status: "ready",
      language: "pt-BR",
      contentText: null,
      contentMarkdown: null,
      sourceUrl: null,
      metadata: { a: 1 }
    });
    (AiKnowledgeDocument.create as jest.Mock).mockResolvedValue({
      id: 6,
      title: "Preços (cópia)",
      status: "draft",
      sourceType: "manual"
    });
    const copy = await DuplicateKnowledgeDocumentService({
      companyId: 1,
      id: 5,
      userId: 1
    });
    expect(AiKnowledgeDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Preços (cópia)",
        status: "draft",
        sourceType: "manual",
        storagePath: null,
        checksum: null
      })
    );
    expect(copy.status).toBe("draft");
  });

  it("soft-deletes document", async () => {
    const destroy = jest.fn();
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 8,
      companyId: 1,
      storagePath: null,
      destroy
    });
    const result = await DeleteKnowledgeDocumentService({
      companyId: 1,
      id: 8
    });
    expect(destroy).toHaveBeenCalled();
    expect(result.deleted).toBe(true);
  });
});
