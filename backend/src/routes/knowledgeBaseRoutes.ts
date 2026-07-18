import { Router } from "express";
import isAuth from "../middleware/isAuth";
import requireEffectiveModule from "../middleware/requireEffectiveModule";
import * as KnowledgeBaseController from "../controllers/KnowledgeBaseController";
import { KNOWLEDGE_BASE_FEATURE_KEY } from "../config/knowledgeBaseConstants";

const knowledgeBaseRoutes = Router();
const gate = requireEffectiveModule(KNOWLEDGE_BASE_FEATURE_KEY);

knowledgeBaseRoutes.get(
  "/knowledge-bases/dashboard",
  isAuth,
  gate,
  KnowledgeBaseController.dashboard
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/index-batch",
  isAuth,
  gate,
  KnowledgeBaseController.batchIndexDocuments
);

knowledgeBaseRoutes.get(
  "/knowledge-base/embedding-settings",
  isAuth,
  gate,
  KnowledgeBaseController.showEmbeddingSettings
);

knowledgeBaseRoutes.put(
  "/knowledge-base/embedding-settings",
  isAuth,
  gate,
  KnowledgeBaseController.updateEmbeddingSettings
);

knowledgeBaseRoutes.post(
  "/knowledge-base/embedding-settings/test",
  isAuth,
  gate,
  KnowledgeBaseController.testEmbeddingSettings
);

knowledgeBaseRoutes.get(
  "/knowledge-bases",
  isAuth,
  gate,
  KnowledgeBaseController.indexBases
);

knowledgeBaseRoutes.post(
  "/knowledge-bases",
  isAuth,
  gate,
  KnowledgeBaseController.storeBase
);

knowledgeBaseRoutes.get(
  "/knowledge-bases/:id",
  isAuth,
  gate,
  KnowledgeBaseController.showBase
);

knowledgeBaseRoutes.put(
  "/knowledge-bases/:id",
  isAuth,
  gate,
  KnowledgeBaseController.updateBase
);

knowledgeBaseRoutes.delete(
  "/knowledge-bases/:id",
  isAuth,
  gate,
  KnowledgeBaseController.removeBase
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/duplicate",
  isAuth,
  gate,
  KnowledgeBaseController.duplicateBase
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/search",
  isAuth,
  gate,
  KnowledgeBaseController.searchChunks
);

knowledgeBaseRoutes.get(
  "/knowledge-bases/:id/documents",
  isAuth,
  gate,
  KnowledgeBaseController.indexDocuments
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/documents",
  isAuth,
  gate,
  KnowledgeBaseController.storeDocument
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/documents/upload",
  isAuth,
  gate,
  KnowledgeBaseController.knowledgeUpload.single("file"),
  KnowledgeBaseController.uploadDocument
);

knowledgeBaseRoutes.get(
  "/knowledge-bases/:id/documents/:documentId",
  isAuth,
  gate,
  KnowledgeBaseController.showDocument
);

knowledgeBaseRoutes.put(
  "/knowledge-bases/:id/documents/:documentId",
  isAuth,
  gate,
  KnowledgeBaseController.updateDocument
);

knowledgeBaseRoutes.delete(
  "/knowledge-bases/:id/documents/:documentId",
  isAuth,
  gate,
  KnowledgeBaseController.removeDocument
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/documents/:documentId/duplicate",
  isAuth,
  gate,
  KnowledgeBaseController.duplicateDocument
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/documents/:documentId/process",
  isAuth,
  gate,
  KnowledgeBaseController.processDocument
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/documents/:documentId/reprocess",
  isAuth,
  gate,
  KnowledgeBaseController.reprocessDocument
);

knowledgeBaseRoutes.get(
  "/knowledge-bases/:id/documents/:documentId/processings",
  isAuth,
  gate,
  KnowledgeBaseController.listDocumentProcessings
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/documents/:documentId/index",
  isAuth,
  gate,
  KnowledgeBaseController.indexDocument
);

knowledgeBaseRoutes.post(
  "/knowledge-bases/:id/documents/:documentId/reindex",
  isAuth,
  gate,
  KnowledgeBaseController.reindexDocument
);

knowledgeBaseRoutes.get(
  "/knowledge-bases/:id/documents/:documentId/indexings",
  isAuth,
  gate,
  KnowledgeBaseController.listDocumentIndexings
);

knowledgeBaseRoutes.get(
  "/knowledge-bases/:id/documents/:documentId/indexings/:indexingId",
  isAuth,
  gate,
  KnowledgeBaseController.showDocumentIndexing
);

export default knowledgeBaseRoutes;
