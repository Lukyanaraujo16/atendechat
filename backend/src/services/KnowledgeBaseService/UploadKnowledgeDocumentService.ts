import crypto from "crypto";
import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import {
  KNOWLEDGE_UPLOAD_ALLOWED_EXTENSIONS,
  KNOWLEDGE_UPLOAD_MAX_BYTES
} from "../../config/knowledgeBaseConstants";
import {
  findKnowledgeBaseOrThrow,
  normalizeOptionalString,
  parseDocumentStatus,
  parseDocumentType,
  parseLanguage,
  parseRequiredTitle
} from "./knowledgeBaseTenant";

function ensureCompanyDir(companyId: number): string {
  const dir = path.resolve(
    process.cwd(),
    "public",
    "knowledge-base",
    `company-${companyId}`
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function assertAllowedUpload(file: Express.Multer.File): void {
  const original = String(file.originalname || "");
  const ext = path.extname(original).toLowerCase();
  if (
    !(KNOWLEDGE_UPLOAD_ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
  ) {
    throw new AppError(
      "ERR_KNOWLEDGE_UPLOAD_INVALID_TYPE",
      400,
      "Tipo de ficheiro não permitido. Use TXT, MD, PDF ou DOCX."
    );
  }
  if (!file.buffer || file.buffer.length === 0) {
    throw new AppError(
      "ERR_KNOWLEDGE_UPLOAD_EMPTY",
      400,
      "Ficheiro vazio."
    );
  }
  if (file.buffer.length > KNOWLEDGE_UPLOAD_MAX_BYTES) {
    throw new AppError(
      "ERR_KNOWLEDGE_UPLOAD_TOO_LARGE",
      400,
      "Ficheiro excede o tamanho máximo de 20 MB."
    );
  }
}

/**
 * Armazena o ficheiro bruto e metadados; enfileira extração assíncrona (1.5.2B).
 * A extração NÃO ocorre na requisição HTTP.
 */
export default async function UploadKnowledgeDocumentService(input: {
  companyId: number;
  knowledgeBaseId: number;
  userId: number | null;
  file: Express.Multer.File;
  body: {
    title?: unknown;
    description?: unknown;
    documentType?: unknown;
    status?: unknown;
    language?: unknown;
  };
}): Promise<AiKnowledgeDocument> {
  await findKnowledgeBaseOrThrow(input.companyId, input.knowledgeBaseId);
  assertAllowedUpload(input.file);

  const checksum = crypto
    .createHash("sha256")
    .update(input.file.buffer)
    .digest("hex");

  const ext = path.extname(input.file.originalname).toLowerCase();
  const safeBase = String(input.file.originalname || "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const storedName = `${Date.now()}-${checksum.slice(0, 12)}-${safeBase}`;
  const dir = ensureCompanyDir(input.companyId);
  const absolutePath = path.join(dir, storedName);
  fs.writeFileSync(absolutePath, input.file.buffer);

  const relativePath = path.join(
    "public",
    "knowledge-base",
    `company-${input.companyId}`,
    storedName
  );

  const title =
    parseRequiredTitle(
      input.body.title ||
        path.basename(input.file.originalname, ext) ||
        "Documento"
    );

  const doc = await AiKnowledgeDocument.create({
    companyId: input.companyId,
    knowledgeBaseId: input.knowledgeBaseId,
    title,
    description: normalizeOptionalString(input.body.description),
    documentType: parseDocumentType(input.body.documentType ?? "general"),
    sourceType: "upload",
    status: parseDocumentStatus(input.body.status, "draft"),
    language: parseLanguage(input.body.language),
    contentText: null,
    contentMarkdown: null,
    sourceUrl: null,
    fileName: input.file.originalname,
    mimeType: input.file.mimetype || null,
    fileSize: input.file.buffer.length,
    checksum,
    storagePath: relativePath,
    uploadStatus: "uploaded",
    processingStatus: "pending",
    indexStatus: "pending",
    metadata: {
      originalName: input.file.originalname,
      extension: ext,
      storedAt: new Date().toISOString()
    },
    createdBy: input.userId,
    updatedBy: input.userId
  });

  try {
    const EnqueueKnowledgeDocumentProcessingService = (
      await import("./EnqueueKnowledgeDocumentProcessingService")
    ).default;
    await EnqueueKnowledgeDocumentProcessingService({
      companyId: input.companyId,
      knowledgeDocumentId: doc.id,
      force: false
    });
    await doc.reload();
  } catch {
    // CRUD do upload não depende da fila
  }

  return doc;
}
