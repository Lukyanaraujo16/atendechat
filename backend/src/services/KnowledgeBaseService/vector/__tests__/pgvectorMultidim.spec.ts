jest.mock("../../../../database", () => ({
  __esModule: true,
  default: {
    query: jest.fn().mockResolvedValue([[]])
  }
}));

jest.mock("../../../../models/AiKnowledgeDocumentChunk", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn()
  }
}));

import AppError from "../../../../errors/AppError";
import {
  isKnowledgeVectorStoreFallbackAllowed,
  resolveKnowledgeVectorStoreDriver
} from "../../../../config/knowledgeBaseConstants";
import {
  assertEmbeddingLengthMatchesDimensions,
  pgVectorColumnForDimensions,
  resolveEmbeddingModelConfiguration
} from "../../../../config/knowledgeEmbeddingModels";
import AiKnowledgeDocumentChunk from "../../../../models/AiKnowledgeDocumentChunk";
import { PgVectorStore } from "../PgVectorStore";
import { ByteaCosineVectorStore } from "../ByteaCosineVectorStore";
import {
  float32ArrayToBuffer,
  bufferToFloat32Array,
  cosineSimilarity
} from "../../embeddings/embeddingUtils";

describe("pgvector multidimensional hardening", () => {
  const originalStore = process.env.KNOWLEDGE_VECTOR_STORE;
  const originalFallback = process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK;

  afterEach(() => {
    if (originalStore === undefined) delete process.env.KNOWLEDGE_VECTOR_STORE;
    else process.env.KNOWLEDGE_VECTOR_STORE = originalStore;
    if (originalFallback === undefined) {
      delete process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK;
    } else {
      process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK = originalFallback;
    }
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("maps dimensions to dedicated pgvector columns", () => {
    expect(pgVectorColumnForDimensions(768)).toBe("embeddingVector768");
    expect(pgVectorColumnForDimensions(1536)).toBe("embeddingVector1536");
    expect(pgVectorColumnForDimensions(3072)).toBe("embeddingVector3072");
    expect(pgVectorColumnForDimensions(512)).toBeNull();
  });

  it("resolves Gemini 768 and OpenAI small/large dims from catalog", () => {
    expect(
      resolveEmbeddingModelConfiguration("gemini", "text-embedding-004")
        .dimensions
    ).toBe(768);
    expect(
      resolveEmbeddingModelConfiguration("gemini", "embedding-001").dimensions
    ).toBe(768);
    expect(
      resolveEmbeddingModelConfiguration("openai", "text-embedding-3-small")
        .dimensions
    ).toBe(1536);
    expect(
      resolveEmbeddingModelConfiguration("openai", "text-embedding-3-large")
        .dimensions
    ).toBe(3072);
    expect(
      resolveEmbeddingModelConfiguration("openai", "text-embedding-ada-002")
        .dimensions
    ).toBe(1536);
  });

  it("rejects vector length mismatch for 768/1536/3072", () => {
    expect(() =>
      assertEmbeddingLengthMatchesDimensions([1, 2, 3], 768)
    ).toThrow(AppError);
    expect(() =>
      assertEmbeddingLengthMatchesDimensions(new Array(768).fill(0.1), 768)
    ).not.toThrow();
    expect(() =>
      assertEmbeddingLengthMatchesDimensions(new Array(1536).fill(0.1), 1536)
    ).not.toThrow();
    expect(() =>
      assertEmbeddingLengthMatchesDimensions(new Array(3072).fill(0.1), 3072)
    ).not.toThrow();
    expect(() =>
      assertEmbeddingLengthMatchesDimensions(new Array(768).fill(0.1), 1536)
    ).toThrow(AppError);
  });

  it("BYTEA remains functional for all catalog dimensions", () => {
    const store = new ByteaCosineVectorStore();
    expect(() => store.assertSupportsDimensions(768)).not.toThrow();
    expect(() => store.assertSupportsDimensions(1536)).not.toThrow();
    expect(() => store.assertSupportsDimensions(3072)).not.toThrow();
  });

  it("pgvector unavailable without fallback fails explicitly", async () => {
    process.env.KNOWLEDGE_VECTOR_STORE = "pgvector";
    delete process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK;
    expect(resolveKnowledgeVectorStoreDriver()).toBe("pgvector");
    expect(isKnowledgeVectorStoreFallbackAllowed()).toBe(false);

    const store = new PgVectorStore();
    (store as any).availability = {
      extension: false,
      columns: {
        embeddingVector768: false,
        embeddingVector1536: false,
        embeddingVector3072: false
      }
    };

    await expect(store.assertSupportsDimensions(1536)).rejects.toMatchObject({
      message: "ERR_KNOWLEDGE_VECTOR_STORE_UNAVAILABLE"
    });
  });

  it("pgvector unavailable with fallback allowed signals explicit FALLBACK", async () => {
    process.env.KNOWLEDGE_VECTOR_STORE = "pgvector";
    process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK = "true";
    const store = new PgVectorStore();
    (store as any).availability = {
      extension: false,
      columns: {
        embeddingVector768: false,
        embeddingVector1536: false,
        embeddingVector3072: false
      }
    };

    await expect(store.assertSupportsDimensions(768)).rejects.toMatchObject({
      message: "ERR_KNOWLEDGE_VECTOR_FALLBACK"
    });
    await expect(
      store.persistEmbedding({
        chunkId: 1,
        embedding: new Array(768).fill(0.01),
        dimensions: 768
      })
    ).resolves.toBeUndefined();
  });

  it("rejects persist when length differs from dimensions", async () => {
    process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK = "true";
    const store = new PgVectorStore();
    await expect(
      store.persistEmbedding({
        chunkId: 1,
        embedding: new Array(100).fill(0),
        dimensions: 768
      })
    ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_EMBEDDING_DIMENSION" });
  });

  it("BYTEA search filters by provider/model/dimensions (no silent mix)", async () => {
    (AiKnowledgeDocumentChunk.findAll as jest.Mock).mockResolvedValue([
      {
        id: 1,
        knowledgeDocumentId: 1,
        knowledgeBaseId: 1,
        content: "gemini chunk",
        title: null,
        sectionTitle: null,
        documentType: "faq",
        language: "pt-BR",
        sourceType: "manual",
        metadata: null,
        embedding: float32ArrayToBuffer(new Array(768).fill(1))
      }
    ]);

    const store = new ByteaCosineVectorStore();
    const hits = await store.searchByEmbedding(new Array(768).fill(1), {
      companyId: 99,
      embeddingProvider: "gemini",
      embeddingModel: "text-embedding-004",
      embeddingDimensions: 768,
      limit: 5
    });

    expect(hits).toHaveLength(1);
    expect(hits[0].score).toBeCloseTo(1);
    expect(AiKnowledgeDocumentChunk.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 99,
          embeddingProvider: "gemini",
          embeddingModel: "text-embedding-004",
          embeddingDimensions: 768,
          enabled: true
        })
      })
    );
  });

  it("does not compare mismatched dimensions in cosine helper usage", () => {
    expect(cosineSimilarity(new Array(768).fill(1), new Array(768).fill(1))).toBeCloseTo(
      1
    );
    expect(cosineSimilarity(new Array(768).fill(1), new Array(1536).fill(1))).toBe(
      0
    );
  });

  it("roundtrips float buffers for 768/1536/3072", () => {
    for (const dim of [768, 1536, 3072]) {
      const values = new Array(dim).fill(0).map((_, i) => (i % 10) / 10);
      const back = bufferToFloat32Array(float32ArrayToBuffer(values));
      expect(back).toHaveLength(dim);
      expect(back[0]).toBeCloseTo(values[0], 5);
    }
  });

  it("catalog marks model change as different configuration dimensions", () => {
    const a = resolveEmbeddingModelConfiguration(
      "gemini",
      "text-embedding-004"
    );
    const b = resolveEmbeddingModelConfiguration(
      "openai",
      "text-embedding-3-small"
    );
    const c = resolveEmbeddingModelConfiguration(
      "openai",
      "text-embedding-3-large"
    );
    expect(a.dimensions).not.toBe(b.dimensions);
    expect(b.dimensions).not.toBe(c.dimensions);
    expect(a.pgvectorColumn).not.toBe(b.pgvectorColumn);
    expect(b.pgvectorColumn).not.toBe(c.pgvectorColumn);
  });

  it("assertVectorStoreReadyForModel switches to BYTEA on explicit FALLBACK", async () => {
    process.env.KNOWLEDGE_VECTOR_STORE = "pgvector";
    process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK = "true";

    jest
      .spyOn(PgVectorStore.prototype, "assertSupportsDimensions")
      .mockRejectedValue(
        new AppError(
          "ERR_KNOWLEDGE_VECTOR_FALLBACK",
          503,
          "pgvector indisponível; fallback BYTEA autorizado."
        )
      );

    const { assertVectorStoreReadyForModel } = await import("../index");
    const plan = await assertVectorStoreReadyForModel({
      provider: "openai",
      model: "text-embedding-3-small"
    });
    expect(plan.usingFallback).toBe(true);
    expect(plan.store.kind).toBe("bytea_cosine_filtered");
    expect(plan.configuration.dimensions).toBe(1536);
  });

  it("assertVectorStoreReadyForModel fails when pgvector unavailable without fallback", async () => {
    process.env.KNOWLEDGE_VECTOR_STORE = "pgvector";
    delete process.env.KNOWLEDGE_VECTOR_STORE_ALLOW_FALLBACK;

    jest
      .spyOn(PgVectorStore.prototype, "assertSupportsDimensions")
      .mockRejectedValue(
        new AppError(
          "ERR_KNOWLEDGE_VECTOR_STORE_UNAVAILABLE",
          503,
          "pgvector indisponível"
        )
      );

    const { assertVectorStoreReadyForModel } = await import("../index");
    await expect(
      assertVectorStoreReadyForModel({
        provider: "gemini",
        model: "text-embedding-004"
      })
    ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_VECTOR_STORE_UNAVAILABLE" });
  });

  it("BYTEA search skips vectors whose length differs from filter dimensions", async () => {
    (AiKnowledgeDocumentChunk.findAll as jest.Mock).mockResolvedValue([
      {
        id: 1,
        knowledgeDocumentId: 1,
        knowledgeBaseId: 1,
        content: "wrong dim",
        title: null,
        sectionTitle: null,
        documentType: "faq",
        language: "pt-BR",
        sourceType: "manual",
        metadata: null,
        embedding: float32ArrayToBuffer(new Array(1536).fill(1))
      },
      {
        id: 2,
        knowledgeDocumentId: 2,
        knowledgeBaseId: 1,
        content: "ok dim",
        title: null,
        sectionTitle: null,
        documentType: "faq",
        language: "pt-BR",
        sourceType: "manual",
        metadata: null,
        embedding: float32ArrayToBuffer(new Array(768).fill(1))
      }
    ]);

    const store = new ByteaCosineVectorStore();
    const hits = await store.searchByEmbedding(new Array(768).fill(1), {
      companyId: 1,
      embeddingProvider: "gemini",
      embeddingModel: "text-embedding-004",
      embeddingDimensions: 768,
      limit: 5
    });
    expect(hits).toHaveLength(1);
    expect(hits[0].chunkId).toBe(2);
  });

  it("BYTEA tenant isolation keeps companyId in every dimension filter", async () => {
    (AiKnowledgeDocumentChunk.findAll as jest.Mock).mockResolvedValue([]);
    const store = new ByteaCosineVectorStore();
    for (const dims of [768, 1536, 3072]) {
      await store.searchByEmbedding(new Array(dims).fill(0.1), {
        companyId: 42,
        embeddingProvider: dims === 768 ? "gemini" : "openai",
        embeddingModel:
          dims === 768
            ? "text-embedding-004"
            : dims === 1536
              ? "text-embedding-3-small"
              : "text-embedding-3-large",
        embeddingDimensions: dims,
        limit: 3
      });
      expect(AiKnowledgeDocumentChunk.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 42,
            embeddingDimensions: dims
          })
        })
      );
    }
  });
});
