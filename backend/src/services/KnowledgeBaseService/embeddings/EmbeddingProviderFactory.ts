import { isAiProviderId } from "../../../config/aiProviderModels";
import AppError from "../../../errors/AppError";
import GeminiEmbeddingProvider from "./GeminiEmbeddingProvider";
import OpenAiEmbeddingProvider from "./OpenAiEmbeddingProvider";
import type { EmbeddingProvider } from "./types";

const providers: EmbeddingProvider[] = [
  new OpenAiEmbeddingProvider(),
  new GeminiEmbeddingProvider()
];

export function EmbeddingProviderFactory(
  provider: string
): EmbeddingProvider {
  if (!isAiProviderId(provider)) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_PROVIDER",
      400,
      "Provider de embedding inválido."
    );
  }
  const match = providers.find(p => p.supportsProvider(provider));
  if (!match) {
    throw new AppError(
      "ERR_KNOWLEDGE_EMBEDDING_PROVIDER",
      400,
      "Provider de embedding não suportado."
    );
  }
  return match;
}

export {
  GeminiEmbeddingProvider,
  OpenAiEmbeddingProvider
};
