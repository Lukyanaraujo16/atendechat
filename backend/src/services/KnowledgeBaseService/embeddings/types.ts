import type { AiProviderId } from "../../../config/aiProviderModels";

export type EmbeddingGenerationResult = {
  embeddings: number[][];
  dimensions: number;
  model: string;
  provider: AiProviderId;
  tokensEstimated?: number;
  tokensExact?: number;
  calls: number;
};

export interface EmbeddingProvider {
  readonly provider: AiProviderId;
  supportsProvider(provider: string): boolean;
  resolveModel(model: string): string;
  getDimensions(model: string): number;
  generateEmbedding(input: {
    apiKey: string;
    model: string;
    text: string;
  }): Promise<number[]>;
  generateEmbeddings(input: {
    apiKey: string;
    model: string;
    texts: string[];
  }): Promise<EmbeddingGenerationResult>;
  validateCredential(input: {
    apiKey: string;
    model: string;
  }): Promise<{ ok: boolean; message: string }>;
  estimateTokens(text: string): number;
}
