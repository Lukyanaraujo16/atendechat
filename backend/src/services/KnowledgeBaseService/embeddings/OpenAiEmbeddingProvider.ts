import { Configuration, OpenAIApi } from "openai";
import {
  AI_PROVIDER_OPENAI,
  AiProviderId
} from "../../../config/aiProviderModels";
import {
  resolveEmbeddingModelDef
} from "../../../config/knowledgeEmbeddingModels";
import AppError from "../../../errors/AppError";
import {
  estimateTokensFromChars,
  sanitizeProviderError
} from "./embeddingUtils";
import type { EmbeddingGenerationResult, EmbeddingProvider } from "./types";

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly provider: AiProviderId = AI_PROVIDER_OPENAI;

  supportsProvider(provider: string): boolean {
    return provider === AI_PROVIDER_OPENAI;
  }

  resolveModel(model: string): string {
    const def = resolveEmbeddingModelDef(AI_PROVIDER_OPENAI, model);
    if (!def) {
      throw new AppError(
        "ERR_KNOWLEDGE_EMBEDDING_MODEL",
        400,
        "Modelo OpenAI de embedding não permitido."
      );
    }
    return def.model;
  }

  getDimensions(model: string): number {
    const def = resolveEmbeddingModelDef(AI_PROVIDER_OPENAI, model);
    if (!def) {
      throw new AppError(
        "ERR_KNOWLEDGE_EMBEDDING_MODEL",
        400,
        "Modelo OpenAI de embedding não permitido."
      );
    }
    return def.dimensions;
  }

  estimateTokens(text: string): number {
    return estimateTokensFromChars(text);
  }

  private client(apiKey: string): OpenAIApi {
    return new OpenAIApi(new Configuration({ apiKey }));
  }

  async generateEmbedding(input: {
    apiKey: string;
    model: string;
    text: string;
  }): Promise<number[]> {
    const result = await this.generateEmbeddings({
      apiKey: input.apiKey,
      model: input.model,
      texts: [input.text]
    });
    return result.embeddings[0];
  }

  async generateEmbeddings(input: {
    apiKey: string;
    model: string;
    texts: string[];
  }): Promise<EmbeddingGenerationResult> {
    const model = this.resolveModel(input.model);
    const dimensions = this.getDimensions(model);
    if (!input.texts.length) {
      return {
        embeddings: [],
        dimensions,
        model,
        provider: this.provider,
        calls: 0,
        tokensEstimated: 0
      };
    }

    try {
      const client = this.client(input.apiKey);
      const response = await client.createEmbedding({
        model,
        input: input.texts
      });
      const data = response.data?.data || [];
      const embeddings = data
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map(row => row.embedding as number[]);

      if (embeddings.length !== input.texts.length) {
        throw new AppError(
          "ERR_KNOWLEDGE_EMBEDDING_PARTIAL",
          502,
          "Resposta parcial do provider de embeddings."
        );
      }
      for (const emb of embeddings) {
        if (!emb || emb.length !== dimensions) {
          throw new AppError(
            "ERR_KNOWLEDGE_EMBEDDING_DIMENSION",
            502,
            "Dimensão de embedding incompatível com a configuração."
          );
        }
      }

      const usageTokens = response.data?.usage?.total_tokens;
      return {
        embeddings,
        dimensions,
        model,
        provider: this.provider,
        calls: 1,
        tokensExact: usageTokens,
        tokensEstimated: input.texts.reduce(
          (acc, t) => acc + this.estimateTokens(t),
          0
        )
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      const sanitized = sanitizeProviderError(err);
      throw new AppError(
        sanitized.code,
        sanitized.retryable ? 429 : 502,
        sanitized.message
      );
    }
  }

  async validateCredential(input: {
    apiKey: string;
    model: string;
  }): Promise<{ ok: boolean; message: string }> {
    try {
      await this.generateEmbedding({
        apiKey: input.apiKey,
        model: input.model,
        text: "knowledge base embedding test"
      });
      return { ok: true, message: "Credencial de embedding válida." };
    } catch (err) {
      const msg =
        err instanceof AppError
          ? err.clientMessage || err.message
          : sanitizeProviderError(err).message;
      return { ok: false, message: msg };
    }
  }
}

export default OpenAiEmbeddingProvider;
