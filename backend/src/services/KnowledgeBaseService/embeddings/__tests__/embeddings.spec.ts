import {
  bufferToFloat32Array,
  cosineSimilarity,
  float32ArrayToBuffer,
  estimateTokensFromChars,
  sanitizeProviderError
} from "../embeddingUtils";
import {
  buildConfigurationHash,
  contentHashFromText
} from "../../ResolveKnowledgeEmbeddingSettingsService";
import { EmbeddingProviderFactory } from "../EmbeddingProviderFactory";
import AppError from "../../../../errors/AppError";
import OpenAiEmbeddingProvider from "../OpenAiEmbeddingProvider";

describe("embedding utils", () => {
  it("roundtrips float32 buffer", () => {
    const values = [0.1, -0.2, 0.5, 1];
    const buf = float32ArrayToBuffer(values);
    const back = bufferToFloat32Array(buf);
    expect(back.length).toBe(4);
    expect(back[0]).toBeCloseTo(0.1, 5);
  });

  it("computes cosine similarity", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("estimates tokens explicitly", () => {
    expect(estimateTokensFromChars("abcd")).toBe(1);
    expect(estimateTokensFromChars("a".repeat(40))).toBe(10);
  });

  it("sanitizes api keys from errors", () => {
    const s = sanitizeProviderError(
      new Error("fail sk-abc123XYZ and Bearer tok")
    );
    expect(s.message).not.toContain("sk-abc");
    expect(s.message).toContain("[redacted]");
  });

  it("hashes content and config for idempotency", () => {
    const a = contentHashFromText("hello");
    const b = contentHashFromText("hello");
    const c = contentHashFromText("hello!");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    const h1 = buildConfigurationHash({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      chunkSize: 800,
      chunkOverlap: 120,
      minChunkSize: 40,
      chunkingVersion: "1.0.0",
      embeddingVersion: "v1"
    });
    const h2 = buildConfigurationHash({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: 1536,
      chunkSize: 900,
      chunkOverlap: 120,
      minChunkSize: 40,
      chunkingVersion: "1.0.0",
      embeddingVersion: "v1"
    });
    expect(h1).not.toBe(h2);
  });
});

describe("EmbeddingProviderFactory", () => {
  it("resolves openai and gemini", () => {
    expect(EmbeddingProviderFactory("openai").provider).toBe("openai");
    expect(EmbeddingProviderFactory("gemini").provider).toBe("gemini");
  });

  it("rejects invalid provider", () => {
    expect(() => EmbeddingProviderFactory("foo")).toThrow(AppError);
  });

  it("validates allowed models and dimensions", () => {
    const p = EmbeddingProviderFactory("openai");
    expect(p.getDimensions("text-embedding-3-small")).toBe(1536);
    expect(() => p.resolveModel("gpt-4o")).toThrow(AppError);
  });
});

describe("OpenAiEmbeddingProvider", () => {
  it("rejects invalid model before calling API", async () => {
    const provider = new OpenAiEmbeddingProvider();
    await expect(
      provider.generateEmbeddings({
        apiKey: "k",
        model: "gpt-4o",
        texts: ["a"]
      })
    ).rejects.toMatchObject({ message: "ERR_KNOWLEDGE_EMBEDDING_MODEL" });
  });

  it("marks rate limit as retryable", () => {
    const s = sanitizeProviderError(new Error("Rate limit exceeded 429"));
    expect(s.retryable).toBe(true);
    expect(s.code).toBe("ERR_KNOWLEDGE_EMBEDDING_TRANSIENT");
  });

  it("marks auth errors as permanent", () => {
    const s = sanitizeProviderError(new Error("401 unauthorized invalid api"));
    expect(s.retryable).toBe(false);
    expect(s.code).toBe("ERR_KNOWLEDGE_EMBEDDING_AUTH");
  });
});
