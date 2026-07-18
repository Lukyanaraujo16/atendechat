import api from "./api";

export function getKnowledgeBaseDashboard() {
  return api.get("/knowledge-bases/dashboard");
}

export function listKnowledgeBases(params) {
  return api.get("/knowledge-bases", { params });
}

export function getKnowledgeBase(id) {
  return api.get(`/knowledge-bases/${id}`);
}

export function createKnowledgeBase(data) {
  return api.post("/knowledge-bases", data);
}

export function updateKnowledgeBase(id, data) {
  return api.put(`/knowledge-bases/${id}`, data);
}

export function deleteKnowledgeBase(id) {
  return api.delete(`/knowledge-bases/${id}`);
}

export function duplicateKnowledgeBase(id) {
  return api.post(`/knowledge-bases/${id}/duplicate`);
}

export function listKnowledgeDocuments(baseId, params) {
  return api.get(`/knowledge-bases/${baseId}/documents`, { params });
}

export function getKnowledgeDocument(baseId, documentId) {
  return api.get(`/knowledge-bases/${baseId}/documents/${documentId}`);
}

export function createKnowledgeDocument(baseId, data) {
  return api.post(`/knowledge-bases/${baseId}/documents`, data);
}

export function updateKnowledgeDocument(baseId, documentId, data) {
  return api.put(`/knowledge-bases/${baseId}/documents/${documentId}`, data);
}

export function deleteKnowledgeDocument(baseId, documentId) {
  return api.delete(`/knowledge-bases/${baseId}/documents/${documentId}`);
}

export function duplicateKnowledgeDocument(baseId, documentId) {
  return api.post(
    `/knowledge-bases/${baseId}/documents/${documentId}/duplicate`
  );
}

export function uploadKnowledgeDocument(baseId, formData) {
  return api.post(`/knowledge-bases/${baseId}/documents/upload`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function processKnowledgeDocument(baseId, documentId) {
  return api.post(
    `/knowledge-bases/${baseId}/documents/${documentId}/process`
  );
}

export function reprocessKnowledgeDocument(baseId, documentId) {
  return api.post(
    `/knowledge-bases/${baseId}/documents/${documentId}/reprocess`
  );
}

export function listKnowledgeDocumentProcessings(baseId, documentId) {
  return api.get(
    `/knowledge-bases/${baseId}/documents/${documentId}/processings`
  );
}
