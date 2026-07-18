import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  AI_PROVIDER_GEMINI,
  AiProviderId
} from "../../../config/aiProviderModels";
import { resolveEmbeddingModelDef } from "../../../config/knowledgeEmbeddingModels";
import AppError from "../../../errors/AppError";
import {
  estimateTokensFromChars,
  sanitizeProviderError
} from "./embeddingUtils";
import type { EmbeddingGenerationResult, EmbeddingProvider } from "./types";

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly provider: AiProviderId = AI_PROVIDER_GEMINI;

  supportsProvider(provider: string): boolean {
    return provider === AI_PROVIDER_GEMINI;
  }

  resolveModel(model: string): string {
    const def = resolveEmbeddingModelDef(AI_PROVIDER_GEMINI, model);
    if (!def) {
      throw new AppError(
        "ERR_KNOWLEDGE_EMBEDDING_MODEL",
        400,
        "Modelo Gemini de embedding não permitido."
      );
    }
    return def.model;
  }

  getDimensions(model: string): number {
    const def = resolveEmbeddingModelDef(AI_PROVIDER_GEMINI, model);
    if (!def) {
      throw new AppError(
        "ERR_KNOWLEDGE_EMBEDDING_MODEL",
        400,
        "Modelo Gemini de embedding não permitido."
      );
    }
    return def.dimensions;
  }

  estimateTokens(text: string): number {
    return estimateTokensFromChars(text);
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
      const genAI = new GoogleGenerativeAI(input.apiKey);
      const embModel = genAI.getGenerativeModel({ model });
      const embeddings: number[][] = [];
      let calls = 0;

      // Gemini tipicamente 1 texto por chamada no SDK atual
      for (const text of input.texts) {
        const result = await embModel.embedContent(text);
        const values = result?.embedding?.values;
        if (!values || !Array.isArray(values)) {
          throw new AppError(
            "ERR_KNOWLEDGE_EMBEDDING_PARTIAL",
            502,
            "Resposta parcial do provider de embeddings."
          );
        }
        if (values.length !== dimensions) {
          throw new AppError(
            "ERR_KNOWLEDGE_EMBEDDING_DIMENSION",
            502,
            "Dimensão de embedding incompatível com a configuração."
          );
        }
        embeddings.push(values.map(Number));
        calls += 1;
      }

      return {
        embeddings,
        dimensions,
        model,
        provider: this.provider,
        calls,
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

export default GeminiEmbeddingProvider;
