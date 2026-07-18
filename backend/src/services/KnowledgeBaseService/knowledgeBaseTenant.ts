import AppError from "../../errors/AppError";
import AiKnowledgeBase from "../../models/AiKnowledgeBase";
import AiKnowledgeDocument from "../../models/AiKnowledgeDocument";
import {
  KNOWLEDGE_DOCUMENT_STATUSES,
  KNOWLEDGE_DOCUMENT_TYPES,
  KNOWLEDGE_SOURCE_TYPES,
  KnowledgeDocumentStatus,
  KnowledgeDocumentType,
  KnowledgeSourceType
} from "../../config/knowledgeBaseConstants";

export function normalizeOptionalString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

export function parseRequiredName(value: unknown, field = "name"): string {
  const s = normalizeOptionalString(value);
  if (!s) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${field} é obrigatório.`
    );
  }
  if (s.length > 160) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      `${field} deve ter no máximo 160 caracteres.`
    );
  }
  return s;
}

export function parseRequiredTitle(value: unknown): string {
  const s = normalizeOptionalString(value);
  if (!s) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "title é obrigatório.");
  }
  if (s.length > 255) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "title deve ter no máximo 255 caracteres."
    );
  }
  return s;
}

export function parseBooleanField(
  value: unknown,
  fallback: boolean
): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  return fallback;
}

export function parseDocumentType(value: unknown): KnowledgeDocumentType {
  const s = String(value ?? "general").trim();
  if (!(KNOWLEDGE_DOCUMENT_TYPES as readonly string[]).includes(s)) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "documentType inválido."
    );
  }
  return s as KnowledgeDocumentType;
}

export function parseSourceType(value: unknown): KnowledgeSourceType {
  const s = String(value ?? "manual").trim();
  if (!(KNOWLEDGE_SOURCE_TYPES as readonly string[]).includes(s)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "sourceType inválido.");
  }
  return s as KnowledgeSourceType;
}

export function parseDocumentStatus(
  value: unknown,
  fallback: KnowledgeDocumentStatus = "draft"
): KnowledgeDocumentStatus {
  if (value === undefined || value === null || value === "") return fallback;
  const s = String(value).trim();
  if (!(KNOWLEDGE_DOCUMENT_STATUSES as readonly string[]).includes(s)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "status inválido.");
  }
  return s as KnowledgeDocumentStatus;
}

export function parseLanguage(value: unknown): string | null {
  const s = normalizeOptionalString(value);
  if (!s) return "pt-BR";
  if (s.length > 16) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "language deve ter no máximo 16 caracteres."
    );
  }
  return s;
}

export function parseOptionalUrl(value: unknown): string | null {
  const s = normalizeOptionalString(value);
  if (!s) return null;
  if (s.length > 2048) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "URL demasiado longa.");
  }
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "URL inválida.");
  }
  return s;
}

export async function findKnowledgeBaseOrThrow(
  companyId: number,
  id: number
): Promise<AiKnowledgeBase> {
  const row = await AiKnowledgeBase.findOne({ where: { id, companyId } });
  if (!row) {
    throw new AppError(
      "ERR_KNOWLEDGE_BASE_NOT_FOUND",
      404,
      "Base de conhecimento não encontrada."
    );
  }
  return row;
}

export async function findKnowledgeDocumentOrThrow(
  companyId: number,
  id: number
): Promise<AiKnowledgeDocument> {
  const row = await AiKnowledgeDocument.findOne({ where: { id, companyId } });
  if (!row) {
    throw new AppError(
      "ERR_KNOWLEDGE_DOCUMENT_NOT_FOUND",
      404,
      "Documento não encontrado."
    );
  }
  return row;
}

export function characterCountPreview(doc: AiKnowledgeDocument): number {
  const md = doc.contentMarkdown || "";
  const txt = doc.contentText || "";
  return Math.max(md.length, txt.length);
}
