import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { CompanyMediaBucket } from "../helpers/companyMediaTypes";
import { formatBytesPtBr } from "../helpers/companyStorage";
import ListCompanyMediaService from "../services/CompanyMediaService/ListCompanyMediaService";
import DeleteCompanyMediaItemService, {
  DeleteCompanyMediaSource
} from "../services/CompanyMediaService/DeleteCompanyMediaItemService";
import BatchDeleteCompanyMediaService from "../services/CompanyMediaService/BatchDeleteCompanyMediaService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  const n = Number(id);
  if (!Number.isFinite(n)) throw new AppError("ERR_NO_PERMISSION", 403);
  return n;
}

const ALLOWED_SOURCES: DeleteCompanyMediaSource[] = [
  "message",
  "quickMessage",
  "schedule",
  "campaign",
  "announcement",
  "fileListOption",
  "chatMessage",
  "flowImage",
  "flowAudio"
];

function parseTypeFilter(raw: string | undefined): CompanyMediaBucket | "all" {
  if (!raw || raw === "all") return "all";
  if (["image", "video", "audio", "document", "other"].includes(raw)) {
    return raw as CompanyMediaBucket;
  }
  return "all";
}

const ALLOWED_SORT = [
  "createdAt_desc",
  "createdAt_asc",
  "size_desc",
  "size_asc"
] as const;

function parseSort(raw: string | undefined): (typeof ALLOWED_SORT)[number] {
  if (raw && (ALLOWED_SORT as readonly string[]).includes(raw)) {
    return raw as (typeof ALLOWED_SORT)[number];
  }
  return "createdAt_desc";
}

export const listCompanyMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const q = req.query as Record<string, string | undefined>;
  const data = await ListCompanyMediaService({
    companyId,
    type: parseTypeFilter(q.type),
    search: q.search,
    startDate: q.startDate,
    endDate: q.endDate,
    page: q.page ? Number(q.page) : undefined,
    limit: q.limit ? Number(q.limit) : undefined,
    sort: parseSort(q.sort)
  });

  return res.json({
    ...data,
    summary: {
      ...data.summary,
      totalFormatted: formatBytesPtBr(data.summary.totalBytes),
      imageFormatted: formatBytesPtBr(data.summary.imageBytes),
      videoFormatted: formatBytesPtBr(data.summary.videoBytes),
      audioFormatted: formatBytesPtBr(data.summary.audioBytes),
      documentFormatted: formatBytesPtBr(data.summary.documentBytes),
      otherFormatted: formatBytesPtBr(data.summary.otherBytes)
    }
  });
};

export const deleteCompanyMediaItem = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const source = String(req.params.source || "") as DeleteCompanyMediaSource;
  const sourceId = decodeURIComponent(String(req.params.sourceId || ""));
  if (!ALLOWED_SOURCES.includes(source)) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  if (!sourceId) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  await DeleteCompanyMediaItemService(companyId, source, sourceId);
  return res.status(204).send();
};

const MAX_BATCH_DELETE = 200;

export const deleteCompanyMediaBatch = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  if (items.length > MAX_BATCH_DELETE) {
    throw new AppError("ERR_VALIDATION", 400);
  }
  const result = await BatchDeleteCompanyMediaService(companyId, items);
  return res.json(result);
};
