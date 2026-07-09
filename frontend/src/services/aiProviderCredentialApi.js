import api from "./api";

export function listAiProviderCredentials() {
  return api.get("/ai-provider-credentials");
}

export function getAiProviderCredential(id) {
  return api.get(`/ai-provider-credentials/${id}`);
}

export function createAiProviderCredential(data) {
  return api.post("/ai-provider-credentials", data);
}

export function updateAiProviderCredential(id, data) {
  return api.put(`/ai-provider-credentials/${id}`, data);
}

export function deleteAiProviderCredential(id) {
  return api.delete(`/ai-provider-credentials/${id}`);
}

export function testAiProviderCredential(id) {
  return api.post(`/ai-provider-credentials/${id}/test`);
}
