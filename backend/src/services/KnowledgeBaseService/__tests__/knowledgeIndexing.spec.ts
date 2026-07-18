jest.mock("../../../libs/knowledgeDocumentIndexQueue", () => ({
  knowledgeDocumentIndexQueue: {
    add: jest.fn().mockResolvedValue({ id: "job-idx" })
  }
}));

jest.mock("../vector", () => ({
  __esModule: true,
  assertVectorStoreReadyForModel: jest.fn().mockResolvedValue({
    store: {
      kind: "bytea_cosine_filtered",
      assertSupportsDimensions: jest.fn(),
      searchByEmbedding: jest.fn()
    },
    configuration: { dimensions: 1536 },
    usingFallback: false
  }),
  resolveKnowledgeVectorStore: jest.fn(),
  ByteaCosineVectorStore: jest.requireActual("../vector/ByteaCosineVectorStore")
    .ByteaCosineVectorStore,
  PgVectorStore: class {
    kind = "pgvector";
  }
}));

jest.mock("../../../models/AiKnowledgeDocument", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeDocumentIndexing", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/AiKnowledgeDocumentChunk", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn()
  }
}));

jest.mock("../ResolveKnowledgeEmbeddingSettingsService", () => {
  const actual = jest.requireActual(
    "../ResolveKnowledgeEmbeddingSettingsService"
  );
  return {
    __esModule: true,
    ...actual,
    default: jest.fn()
  };
});

import AiKnowledgeDocument from "../../../models/AiKnowledgeDocument";
import AiKnowledgeDocumentIndexing from "../../../models/AiKnowledgeDocumentIndexing";
import AiKnowledgeDocumentChunk from "../../../models/AiKnowledgeDocumentChunk";
import { knowledgeDocumentIndexQueue } from "../../../libs/knowledgeDocumentIndexQueue";
import EnqueueKnowledgeDocumentIndexingService from "../EnqueueKnowledgeDocumentIndexingService";
import ResolveKnowledgeEmbeddingSettingsService from "../ResolveKnowledgeEmbeddingSettingsService";
import MarkKnowledgeDocumentsIndexOutdatedByConfigService from "../MarkKnowledgeDocumentsIndexOutdatedByConfigService";
import { ByteaCosineVectorStore } from "../vector/ByteaCosineVectorStore";
import { float32ArrayToBuffer } from "../embeddings/embeddingUtils";

describe("Knowledge indexing pipeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects documents not processed", async () => {
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      companyId: 1,
      processingStatus: "pending",
      contentText: "x"
    });
    await expect(
      EnqueueKnowledgeDocumentIndexingService({
        companyId: 1,
        knowledgeDocumentId: 1
      })
    ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_INDEX_NOT_PROCESSED" });
  });

  it("rejects empty content", async () => {
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      companyId: 1,
      processingStatus: "completed",
      contentText: "  "
    });
    await expect(
      EnqueueKnowledgeDocumentIndexingService({
        companyId: 1,
        knowledgeDocumentId: 1
      })
    ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_INDEX_EMPTY_CONTENT" });
  });

  it("skips when same config already indexed", async () => {
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      companyId: 1,
      processingStatus: "completed",
      contentText: "hello world",
      checksum: "c1",
      indexStatus: "completed",
      update: jest.fn(),
      reload: jest.fn()
    });
    (ResolveKnowledgeEmbeddingSettingsService as jest.Mock).mockResolvedValue({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      configurationHash: "cfg",
      settings: {
        chunkSize: 800,
        chunkOverlap: 120,
        minChunkSize: 40,
        batchSize: 16
      }
    });
    const crypto = require("crypto");
    const contentHash = crypto
      .createHash("sha256")
      .update("hello world")
      .digest("hex");
    (AiKnowledgeDocumentIndexing.findOne as jest.Mock).mockResolvedValue({
      id: 9,
      contentHash,
      configurationHash: "cfg",
      embeddingProvider: "openai",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      chunkingVersion: "1.0.0",
      status: "completed",
      isActive: true
    });

    const result = await EnqueueKnowledgeDocumentIndexingService({
      companyId: 1,
      knowledgeDocumentId: 1,
      force: false
    });
    expect(result.enqueued).toBe(false);
    expect(result.skippedReason).toBe("already_indexed_same_config");
    expect(knowledgeDocumentIndexQueue.add).not.toHaveBeenCalled();
  });

  it("enqueues indexing and creates history", async () => {
    const update = jest.fn();
    const reload = jest.fn();
    (AiKnowledgeDocument.findOne as jest.Mock).mockResolvedValue({
      id: 1,
      companyId: 1,
      processingStatus: "completed",
      contentText: "conteudo indexavel",
      checksum: null,
      indexStatus: "pending",
      update,
      reload
    });
    (ResolveKnowledgeEmbeddingSettingsService as jest.Mock).mockResolvedValue({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      configurationHash: "cfg",
      embeddingVersion: "v1",
      settings: {
        chunkSize: 800,
        chunkOverlap: 120,
        minChunkSize: 40,
        batchSize: 16
      }
    });
    (AiKnowledgeDocumentIndexing.count as jest.Mock).mockResolvedValue(0);
    (AiKnowledgeDocumentIndexing.create as jest.Mock).mockResolvedValue({
      id: 55,
      status: "queued"
    });

    const result = await EnqueueKnowledgeDocumentIndexingService({
      companyId: 1,
      knowledgeDocumentId: 1
    });
    expect(result.enqueued).toBe(true);
    expect(knowledgeDocumentIndexQueue.add).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ indexStatus: "queued" })
    );
  });

  it("marks documents outdated on config change", async () => {
    (AiKnowledgeDocument.update as jest.Mock).mockResolvedValue([3]);
    const count = await MarkKnowledgeDocumentsIndexOutdatedByConfigService({
      companyId: 10
    });
    expect(count).toBe(3);
  });

  it("bytea vector store filters by tenant and ranks by cosine", async () => {
    const q = new Array(4).fill(1);
    (AiKnowledgeDocumentChunk.findAll as jest.Mock).mockResolvedValue([
      {
        id: 1,
        knowledgeDocumentId: 1,
        knowledgeBaseId: 1,
        content: "a",
        title: "t",
        sectionTitle: null,
        documentType: "faq",
        language: "pt-BR",
        sourceType: "manual",
        metadata: null,
        embedding: float32ArrayToBuffer([1, 0, 0, 0])
      },
      {
        id: 2,
        knowledgeDocumentId: 2,
        knowledgeBaseId: 1,
        content: "b",
        title: "t2",
        sectionTitle: null,
        documentType: "faq",
        language: "pt-BR",
        sourceType: "manual",
        metadata: null,
        embedding: float32ArrayToBuffer([1, 1, 1, 1])
      }
    ]);
    const store = new ByteaCosineVectorStore();
    const hits = await store.searchByEmbedding(q, {
      companyId: 1,
      embeddingProvider: "openai",
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 4,
      limit: 1
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].chunkId).toBe(2);
    expect(AiKnowledgeDocumentChunk.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 1, enabled: true })
      })
    );
  });
});
