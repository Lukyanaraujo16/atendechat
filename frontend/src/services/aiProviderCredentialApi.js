import api from "./api";

/** Lista credenciais (legado). Ainda usado pela Knowledge Base Embedding. */
export function listAiProviderCredentials() {
  return api.get("/ai-provider-credentials");
}
