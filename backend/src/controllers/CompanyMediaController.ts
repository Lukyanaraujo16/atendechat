import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { CompanyMediaBucket } from "../helpers/companyMediaTypes";
import { formatBytesPtBr } from "../helpers/companyStorage";
import { buildEmptyCompanyMediaListResponse } from "../helpers/companyMediaListFallback";
import { logger } from "../utils/logger";
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

/** Express pode entregar query como string ou string[] — normalizar. */
function firstQueryString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (Array.isArray(v)) {
    const x = v[0];
    return x == null ? undefined : String(x);
  }
  return String(v);
}

function parseTypeFilter(raw: string | undefined): CompanyMediaBucket | "all" {
  const s = raw?.trim().toLowerCase() || "";
  if (!s || s === "all") return "all";
  if (["image", "video", "audio", "document", "other"].includes(s)) {
    return s as CompanyMediaBucket;
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
  const s = raw?.trim() || "";
  if (s && (ALLOWED_SORT as readonly string[]).includes(s)) {
    return s as (typeof ALLOWED_SORT)[number];
  }
  return "createdAt_desc";
}

function safePageLimit(q: Record<string, unknown>) {
  const pageRaw = firstQueryString(q.page);
  const limitRaw = firstQueryString(q.limit);
  const pageNum = Math.max(1, Number(pageRaw) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limitRaw) || 25));
  return { pageNum, limitNum };
}

export const listCompanyMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const q = req.query as Record<string, unknown>;
  const userSnap = {
    id: req.user?.id,
    companyId: req.user?.companyId,
    profile: req.user?.profile,
    supportMode: req.user?.supportMode
  };

  try {
    logger.info({ query: q, user: userSnap }, "[CompanyMedia] list request received");
  } catch {
    /* ignore logger failure */
  }

  try {
    const companyId = companyIdOrThrow(req);
    const { pageNum, limitNum } = safePageLimit(q);

    const data = await ListCompanyMediaService({
      companyId,
      type: parseTypeFilter(firstQueryString(q.type)),
      search: firstQueryString(q.search),
      startDate: firstQueryString(q.startDate),
      endDate: firstQueryString(q.endDate),
      page: pageNum,
      limit: limitNum,
      sort: parseSort(firstQueryString(q.sort))
    });

    const items = Array.isArray(data?.items) ? data.items : [];
    const count = Math.max(0, Number(data?.count) || 0);
    const hasMore = Boolean(data?.hasMore);

    const summaryNums = {
      totalBytes: Number(data?.summary?.totalBytes) || 0,
      imageBytes: Number(data?.summary?.imageBytes) || 0,
      videoBytes: Number(data?.summary?.videoBytes) || 0,
      audioBytes: Number(data?.summary?.audioBytes) || 0,
      documentBytes: Number(data?.summary?.documentBytes) || 0,
      otherBytes: Number(data?.summary?.otherBytes) || 0
    };

    return res.json({
      items,
      count,
      hasMore,
      summary: {
        ...summaryNums,
        totalFormatted: formatBytesPtBr(summaryNums.totalBytes),
        imageFormatted: formatBytesPtBr(summaryNums.imageBytes),
        videoFormatted: formatBytesPtBr(summaryNums.videoBytes),
        audioFormatted: formatBytesPtBr(summaryNums.audioBytes),
        documentFormatted: formatBytesPtBr(summaryNums.documentBytes),
        otherFormatted: formatBytesPtBr(summaryNums.otherBytes)
      }
    });
  } catch (err) {
    try {
      logger.error(
        {
          companyId: req.user?.companyId,
          userId: req.user?.id,
          query: q,
          user: userSnap,
          err: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined
        },
        "[CompanyMedia] list failed"
      );
    } catch {
      /* evitar falha secundária se o logger falhar em produção */
    }

    return res.status(200).json(buildEmptyCompanyMediaListResponse({ error: true }));
  }
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
