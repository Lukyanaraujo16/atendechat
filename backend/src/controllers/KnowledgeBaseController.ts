import { Request, Response } from "express";
import multer from "multer";
import AppError from "../errors/AppError";
import { KNOWLEDGE_UPLOAD_MAX_BYTES } from "../config/knowledgeBaseConstants";
import CreateKnowledgeBaseService from "../services/KnowledgeBaseService/CreateKnowledgeBaseService";
import UpdateKnowledgeBaseService from "../services/KnowledgeBaseService/UpdateKnowledgeBaseService";
import DeleteKnowledgeBaseService from "../services/KnowledgeBaseService/DeleteKnowledgeBaseService";
import DuplicateKnowledgeBaseService from "../services/KnowledgeBaseService/DuplicateKnowledgeBaseService";
import ListKnowledgeBasesService from "../services/KnowledgeBaseService/ListKnowledgeBasesService";
import ShowKnowledgeBaseService from "../services/KnowledgeBaseService/ShowKnowledgeBaseService";
import CreateKnowledgeDocumentService from "../services/KnowledgeBaseService/CreateKnowledgeDocumentService";
import UpdateKnowledgeDocumentService from "../services/KnowledgeBaseService/UpdateKnowledgeDocumentService";
import DeleteKnowledgeDocumentService from "../services/KnowledgeBaseService/DeleteKnowledgeDocumentService";
import DuplicateKnowledgeDocumentService from "../services/KnowledgeBaseService/DuplicateKnowledgeDocumentService";
import ListKnowledgeDocumentsService from "../services/KnowledgeBaseService/ListKnowledgeDocumentsService";
import ShowKnowledgeDocumentService from "../services/KnowledgeBaseService/ShowKnowledgeDocumentService";
import UploadKnowledgeDocumentService from "../services/KnowledgeBaseService/UploadKnowledgeDocumentService";
import GetKnowledgeBaseDashboardService from "../services/KnowledgeBaseService/GetKnowledgeBaseDashboardService";
import EnqueueKnowledgeDocumentProcessingService from "../services/KnowledgeBaseService/EnqueueKnowledgeDocumentProcessingService";
import ReprocessKnowledgeDocumentService from "../services/KnowledgeBaseService/ReprocessKnowledgeDocumentService";
import ListKnowledgeDocumentProcessingsService from "../services/KnowledgeBaseService/ListKnowledgeDocumentProcessingsService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return id;
}

function userIdOrNull(req: Request): number | null {
  return req.user?.id != null && Number.isFinite(Number(req.user.id))
    ? Number(req.user.id)
    : null;
}

export const knowledgeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: KNOWLEDGE_UPLOAD_MAX_BYTES }
});

export const dashboard = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const data = await GetKnowledgeBaseDashboardService({ companyId });
  return res.json(data);
};

export const indexBases = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListKnowledgeBasesService({
    companyId,
    search: req.query.search,
    enabled: req.query.enabled
  });
  return res.json(result);
};

export const showBase = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const data = await ShowKnowledgeBaseService({
    companyId,
    id: parseIdParam(req.params.id)
  });
  return res.json(data);
};

export const storeBase = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const base = await CreateKnowledgeBaseService({
    companyId,
    userId: userIdOrNull(req),
    body: req.body
  });
  return res.status(201).json(base);
};

export const updateBase = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const base = await UpdateKnowledgeBaseService({
    companyId,
    id: parseIdParam(req.params.id),
    userId: userIdOrNull(req),
    body: req.body
  });
  return res.json(base);
};

export const removeBase = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await DeleteKnowledgeBaseService({
    companyId,
    id: parseIdParam(req.params.id)
  });
  return res.json(result);
};

export const duplicateBase = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const base = await DuplicateKnowledgeBaseService({
    companyId,
    id: parseIdParam(req.params.id),
    userId: userIdOrNull(req)
  });
  return res.status(201).json(base);
};

export const indexDocuments = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListKnowledgeDocumentsService({
    companyId,
    knowledgeBaseId: parseIdParam(req.params.id),
    search: req.query.search,
    documentType: req.query.documentType,
    sourceType: req.query.sourceType,
    status: req.query.status,
    processingStatus: req.query.processingStatus,
    language: req.query.language
  });
  return res.json(result);
};

export const showDocument = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const data = await ShowKnowledgeDocumentService({
    companyId,
    id: parseIdParam(req.params.documentId)
  });
  return res.json(data);
};

export const storeDocument = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const doc = await CreateKnowledgeDocumentService({
    companyId,
    knowledgeBaseId: parseIdParam(req.params.id),
    userId: userIdOrNull(req),
    body: req.body
  });
  return res.status(201).json(doc);
};

export const uploadDocument = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  if (!req.file) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Ficheiro é obrigatório."
    );
  }
  const doc = await UploadKnowledgeDocumentService({
    companyId,
    knowledgeBaseId: parseIdParam(req.params.id),
    userId: userIdOrNull(req),
    file: req.file,
    body: req.body
  });
  return res.status(201).json(doc);
};

export const updateDocument = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const doc = await UpdateKnowledgeDocumentService({
    companyId,
    id: parseIdParam(req.params.documentId),
    userId: userIdOrNull(req),
    body: req.body
  });
  return res.json(doc);
};

export const removeDocument = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await DeleteKnowledgeDocumentService({
    companyId,
    id: parseIdParam(req.params.documentId)
  });
  return res.json(result);
};

export const duplicateDocument = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const doc = await DuplicateKnowledgeDocumentService({
    companyId,
    id: parseIdParam(req.params.documentId),
    userId: userIdOrNull(req)
  });
  return res.status(201).json(doc);
};

export const processDocument = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await EnqueueKnowledgeDocumentProcessingService({
    companyId,
    knowledgeDocumentId: parseIdParam(req.params.documentId),
    force: false
  });
  return res.status(202).json(result);
};

export const reprocessDocument = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ReprocessKnowledgeDocumentService({
    companyId,
    knowledgeDocumentId: parseIdParam(req.params.documentId)
  });
  return res.status(202).json(result);
};

export const listDocumentProcessings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListKnowledgeDocumentProcessingsService({
    companyId,
    knowledgeDocumentId: parseIdParam(req.params.documentId)
  });
  return res.json(result);
};
