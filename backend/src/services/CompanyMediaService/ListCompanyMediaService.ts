import path from "path";
import { Op } from "sequelize";
import Message from "../../models/Message";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import QuickMessage from "../../models/QuickMessage";
import Schedule from "../../models/Schedule";
import Campaign from "../../models/Campaign";
import Announcement from "../../models/Announcement";
import Files from "../../models/Files";
import FilesOptions from "../../models/FilesOptions";
import ChatMessage from "../../models/ChatMessage";
import Chat from "../../models/Chat";
import { FlowImgModel } from "../../models/FlowImg";
import { FlowAudioModel } from "../../models/FlowAudio";
import { formatBytesPtBr } from "../../helpers/companyStorage";
import {
  classifyMediaBucket,
  CompanyMediaBucket,
  CompanyMediaSource,
  normalizePublicRelPath
} from "../../helpers/companyMediaTypes";
import { EMPTY_COMPANY_MEDIA_SUMMARY } from "./companyMediaSummaryConstants";
import { resolvePublicMediaStat } from "../../helpers/resolvePublicMediaStat";
import { logger } from "../../utils/logger";

const MAX_PER_SOURCE = 800;

function safeTimeMs(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

function toIsoOrEpoch(d: unknown): string {
  if (d == null) {
    return new Date(0).toISOString();
  }
  if (d instanceof Date && Number.isFinite(d.getTime())) {
    return d.toISOString();
  }
  const parsed = new Date(d as string | number);
  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

/** Estat local em public/; missing só quando há caminho relativo normalizado mas ficheiro não existe. */
function safeStatRel(
  relRaw: string | null | undefined,
  logMeta: { source: CompanyMediaSource; sourceId?: string },
  joinedRel?: string | null
): { sizeBytes: number; missing: boolean; storageRel: string | null } {
  const stat = resolvePublicMediaStat(relRaw, joinedRel);
  if (stat.missing && stat.sizeBytes === 0) {
    logger.warn(
      {
        ...logMeta,
        file: path.basename(String(stat.storageRel || relRaw || ""))
      },
      "[CompanyMedia] missing media file"
    );
  }
  return {
    sizeBytes: stat.sizeBytes,
    missing: stat.missing,
    storageRel: stat.storageRel
  };
}

/** Caminho relativo sob public/ (sem URL absoluta exposta). */
function statSizeForJoinedRel(
  relJoined: string,
  logMeta: { source: CompanyMediaSource; sourceId?: string }
): { sizeBytes: number; missing: boolean; storageRel: string | null } {
  return safeStatRel(null, logMeta, relJoined);
}

function hrefForRel(rel: string): string {
  const s = String(rel || "").trim().replace(/\\/g, "/");
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  const enc = s
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/public/${enc}`;
}

export type CompanyMediaListItem = {
  id: string;
  source: CompanyMediaSource;
  sourceId: string;
  fileName: string;
  mediaUrl: string;
  mimeType: string | null;
  type: CompanyMediaBucket;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  ticketId: number | null;
  contactName: string | null;
  /** Ficheiro local esperado em public/ mas não encontrado (ou path relativo vazio). */
  missing?: boolean;
  /** Caminho relativo em public/ para deduplicação no cálculo de armazenamento. */
  storageRel?: string | null;
};

export type ListCompanyMediaInput = {
  companyId: number;
  type?: CompanyMediaBucket | "all";
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sort?: "createdAt_desc" | "createdAt_asc" | "size_desc" | "size_asc";
};

const ALLOWED_PAGE_LIMITS = [25, 50, 100, 200] as const;
const DEFAULT_PAGE_LIMIT = 25;

function normalizePageLimit(raw?: number): number {
  const n = Number(raw);
  if (ALLOWED_PAGE_LIMITS.includes(n as (typeof ALLOWED_PAGE_LIMITS)[number])) {
    return n;
  }
  return DEFAULT_PAGE_LIMIT;
}

function parsePageLimit(page?: number, limit?: number): { page: number; limit: number; offset: number } {
  const p = Math.max(1, Number(page) || 1);
  const l = normalizePageLimit(limit);
  return { page: p, limit: l, offset: (p - 1) * l };
}

function matchesFilters(
  item: CompanyMediaListItem,
  type: CompanyMediaBucket | "all",
  searchTrim: string,
  start: Date | null,
  end: Date | null
): boolean {
  if (type !== "all" && item.type !== type) return false;
  if (searchTrim) {
    const hay = `${item.fileName} ${item.contactName || ""}`.toLowerCase();
    if (!hay.includes(searchTrim.toLowerCase())) return false;
  }
  const t = safeTimeMs(item.createdAt);
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

function parseTypeFilter(input: ListCompanyMediaInput): CompanyMediaBucket | "all" {
  const raw =
    input.type === undefined || input.type === null ? "" : String(input.type).toLowerCase();
  if (!raw || raw === "all") return "all";
  if (["image", "video", "audio", "document", "other"].includes(raw)) {
    return raw as CompanyMediaBucket;
  }
  return "all";
}

async function loadMessageItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const rows = await Message.findAll({
      where: {
        companyId,
        mediaUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
      },
      attributes: ["id", "mediaUrl", "mediaType", "createdAt", "ticketId", "contactId"],
      include: [{ model: Contact, attributes: ["name"], required: false }],
      order: [["createdAt", "DESC"]],
      limit: MAX_PER_SOURCE
    });

    const out: CompanyMediaListItem[] = [];
    for (const msg of rows) {
      try {
        const rel = msg.getDataValue("mediaUrl") as string;
        const mime = (msg.getDataValue("mediaType") as string) || null;
        const nPath = normalizePublicRelPath(rel);
        const base = path.basename(String(nPath || rel || "file")) || "file";
        const { sizeBytes, missing, storageRel } = safeStatRel(rel, {
          source: "message",
          sourceId: String(msg.id)
        });
        const bucket = classifyMediaBucket(mime, base);
        const c = msg.contact;
        const displayUrl = hrefForRel(String(nPath || rel || ""));

        out.push({
          id: `message:${msg.id}`,
          source: "message",
          sourceId: String(msg.id),
          fileName: base,
          mediaUrl: displayUrl,
          mimeType: mime,
          type: bucket,
          sizeBytes,
          sizeFormatted: formatBytesPtBr(sizeBytes),
          createdAt: toIsoOrEpoch(msg.createdAt),
          ticketId: msg.ticketId ?? null,
          contactName: c?.name != null ? String(c.name) : null,
          missing,
          storageRel
        });
      } catch (rowErr) {
        logger.warn(
          {
            companyId,
            source: "message",
            err: rowErr instanceof Error ? rowErr.message : String(rowErr)
          },
          "[CompanyMedia] skip row"
        );
      }
    }
    return out;
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "message",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

async function loadQuickMessageItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const rows = await QuickMessage.findAll({
      where: {
        companyId,
        mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
      },
      attributes: ["id", "mediaPath", "mediaName", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: MAX_PER_SOURCE
    });
    return rows.map((r) => {
      const inner = String(r.getDataValue("mediaPath") || "");
      const relJoined = path.join("quickMessage", inner);
      const name = r.mediaName || inner;
      const { sizeBytes, missing, storageRel } = statSizeForJoinedRel(relJoined, {
        source: "quickMessage",
        sourceId: String(r.id)
      });
      const bucket = classifyMediaBucket(null, name);
      return {
        id: `quickMessage:${r.id}`,
        source: "quickMessage" as const,
        sourceId: String(r.id),
        fileName: path.basename(name) || name,
        mediaUrl: hrefForRel(relJoined),
        mimeType: null,
        type: bucket,
        sizeBytes,
        sizeFormatted: formatBytesPtBr(sizeBytes),
        createdAt: toIsoOrEpoch(r.createdAt),
        ticketId: null,
        contactName: null,
        missing,
        storageRel
      };
    });
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "quickMessage",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

async function loadScheduleItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const rows = await Schedule.findAll({
      where: {
        companyId,
        mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
      },
      attributes: ["id", "mediaPath", "mediaName", "createdAt", "updatedAt", "ticketId", "contactId"],
      include: [{ model: Contact, attributes: ["name"], required: false }],
      order: [["updatedAt", "DESC"]],
      limit: MAX_PER_SOURCE
    });
    return rows.map((r) => {
      const rel = String(r.getDataValue("mediaPath") || "");
      const name = r.mediaName || rel;
      const { sizeBytes, missing, storageRel } = safeStatRel(rel, {
        source: "schedule",
        sourceId: String(r.id)
      });
      const bucket = classifyMediaBucket(null, name);
      const c = r.contact;
      return {
        id: `schedule:${r.id}`,
        source: "schedule" as const,
        sourceId: String(r.id),
        fileName: path.basename(name) || name,
        mediaUrl: hrefForRel(rel),
        mimeType: null,
        type: bucket,
        sizeBytes,
        sizeFormatted: formatBytesPtBr(sizeBytes),
        createdAt: toIsoOrEpoch(r.updatedAt ?? r.createdAt),
        ticketId: r.ticketId ?? null,
        contactName: c?.name != null ? String(c.name) : null,
        missing,
        storageRel
      };
    });
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "schedule",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

async function loadCampaignItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const rows = await Campaign.findAll({
      where: {
        companyId,
        mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
      },
      attributes: ["id", "mediaPath", "mediaName", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit: MAX_PER_SOURCE
    });
    return rows.map((r) => {
      const rel = String(r.getDataValue("mediaPath") || "");
      const name = r.mediaName || rel;
      const { sizeBytes, missing, storageRel } = safeStatRel(rel, {
        source: "campaign",
        sourceId: String(r.id)
      });
      const bucket = classifyMediaBucket(null, name);
      return {
        id: `campaign:${r.id}`,
        source: "campaign" as const,
        sourceId: String(r.id),
        fileName: path.basename(name) || name,
        mediaUrl: hrefForRel(rel),
        mimeType: null,
        type: bucket,
        sizeBytes,
        sizeFormatted: formatBytesPtBr(sizeBytes),
        createdAt: toIsoOrEpoch(r.updatedAt ?? r.createdAt),
        ticketId: null,
        contactName: null,
        missing,
        storageRel
      };
    });
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "campaign",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

async function loadAnnouncementItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const rows = await Announcement.findAll({
      where: {
        companyId,
        mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
      },
      attributes: ["id", "mediaPath", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit: MAX_PER_SOURCE
    });
    return rows.map((r) => {
      const rel = String(r.getDataValue("mediaPath") || "");
      const { sizeBytes, missing, storageRel } = safeStatRel(rel, {
        source: "announcement",
        sourceId: String(r.id)
      });
      const bucket = classifyMediaBucket(null, rel);
      return {
        id: `announcement:${r.id}`,
        source: "announcement" as const,
        sourceId: String(r.id),
        fileName: path.basename(rel) || "file",
        mediaUrl: hrefForRel(rel),
        mimeType: null,
        type: bucket,
        sizeBytes,
        sizeFormatted: formatBytesPtBr(sizeBytes),
        createdAt: toIsoOrEpoch(r.updatedAt ?? r.createdAt),
        ticketId: null,
        contactName: null,
        missing,
        storageRel
      };
    });
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "announcement",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

async function loadFileListItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const lists = await Files.findAll({
      where: { companyId },
      include: [{ model: FilesOptions, as: "options", required: false }],
      limit: MAX_PER_SOURCE
    });
    const out: CompanyMediaListItem[] = [];
    for (const fl of lists) {
      const opts = fl.options || [];
      for (const opt of opts) {
        try {
          if (!opt.path) continue;
          const relJoined = path.join("fileList", String(fl.id), opt.path);
          const { sizeBytes, missing, storageRel } = statSizeForJoinedRel(relJoined, {
            source: "fileListOption",
            sourceId: String(opt.id)
          });
          const bucket = classifyMediaBucket(opt.mediaType, opt.path);
          out.push({
            id: `fileListOption:${opt.id}`,
            source: "fileListOption",
            sourceId: String(opt.id),
            fileName: path.basename(opt.path),
            mediaUrl: hrefForRel(relJoined),
            mimeType: opt.mediaType ?? null,
            type: bucket,
            sizeBytes,
            sizeFormatted: formatBytesPtBr(sizeBytes),
            createdAt: toIsoOrEpoch(opt.updatedAt ?? opt.createdAt),
            ticketId: null,
            contactName: null,
            missing,
            storageRel
          });
        } catch (rowErr) {
          logger.warn(
            {
              companyId,
              source: "fileListOption",
              err: rowErr instanceof Error ? rowErr.message : String(rowErr)
            },
            "[CompanyMedia] skip row"
          );
        }
      }
    }
    out.sort((a, b) => safeTimeMs(b.createdAt) - safeTimeMs(a.createdAt));
    return out.slice(0, MAX_PER_SOURCE);
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "fileList",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

async function loadChatMessageItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const rows = await ChatMessage.findAll({
      where: {
        mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
      },
      attributes: ["id", "mediaPath", "mediaName", "createdAt"],
      include: [{ model: Chat, attributes: [], where: { companyId }, required: true }],
      order: [["createdAt", "DESC"]],
      limit: MAX_PER_SOURCE
    });
    return rows.map((r) => {
      const rel = String(r.getDataValue("mediaPath") || "");
      const name = r.mediaName || rel;
      const { sizeBytes, missing, storageRel } = safeStatRel(rel, {
        source: "chatMessage",
        sourceId: String(r.id)
      });
      const bucket = classifyMediaBucket(null, name);
      return {
        id: `chatMessage:${r.id}`,
        source: "chatMessage" as const,
        sourceId: String(r.id),
        fileName: path.basename(name) || name,
        mediaUrl: hrefForRel(rel),
        mimeType: null,
        type: bucket,
        sizeBytes,
        sizeFormatted: formatBytesPtBr(sizeBytes),
        createdAt: toIsoOrEpoch(r.createdAt),
        ticketId: null,
        contactName: null,
        missing,
        storageRel
      };
    });
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "chatMessage",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

async function loadFlowImageItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const rows = await FlowImgModel.findAll({
      where: { companyId },
      attributes: ["id", "name", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit: MAX_PER_SOURCE
    });
    return rows.map((r) => {
      const rel = String(r.name || "");
      const { sizeBytes, missing, storageRel } = safeStatRel(rel, {
        source: "flowImage",
        sourceId: String(r.id)
      });
      const bucket = classifyMediaBucket("image/png", rel);
      return {
        id: `flowImage:${r.id}`,
        source: "flowImage" as const,
        sourceId: String(r.id),
        fileName: path.basename(rel) || `flow-img-${r.id}`,
        mediaUrl: hrefForRel(rel),
        mimeType: "image/png",
        type: bucket,
        sizeBytes,
        sizeFormatted: formatBytesPtBr(sizeBytes),
        createdAt: toIsoOrEpoch(r.updatedAt ?? r.createdAt),
        ticketId: null,
        contactName: null,
        missing,
        storageRel
      };
    });
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "flowImage",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

async function loadFlowAudioItems(companyId: number): Promise<CompanyMediaListItem[]> {
  try {
    const rows = await FlowAudioModel.findAll({
      where: { companyId },
      attributes: ["id", "name", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
      limit: MAX_PER_SOURCE
    });
    return rows.map((r) => {
      const rel = String(r.name || "");
      const { sizeBytes, missing, storageRel } = safeStatRel(rel, {
        source: "flowAudio",
        sourceId: String(r.id)
      });
      const bucket = classifyMediaBucket("audio/ogg", rel);
      return {
        id: `flowAudio:${r.id}`,
        source: "flowAudio" as const,
        sourceId: String(r.id),
        fileName: path.basename(rel) || `flow-audio-${r.id}`,
        mediaUrl: hrefForRel(rel),
        mimeType: "audio/ogg",
        type: bucket,
        sizeBytes,
        sizeFormatted: formatBytesPtBr(sizeBytes),
        createdAt: toIsoOrEpoch(r.updatedAt ?? r.createdAt),
        ticketId: null,
        contactName: null,
        missing,
        storageRel
      };
    });
  } catch (err) {
    logger.warn(
      {
        companyId,
        loader: "flowAudio",
        err: err instanceof Error ? err.message : String(err)
      },
      "[CompanyMedia] list loader failed"
    );
    return [];
  }
}

export type CompanyMediaTotalResult = {
  totalBytes: number;
  imageBytes: number;
  videoBytes: number;
  audioBytes: number;
  documentBytes: number;
  otherBytes: number;
  bySource: Record<string, { count: number; bytes: number }>;
  fileCount: number;
};

/**
 * Fonte única de verdade: mesmos loaders da tabela da Gestão de mídias,
 * com deduplicação por ficheiro em public/.
 */
export async function calculateCompanyMediaTotalBytes(
  companyId: number
): Promise<CompanyMediaTotalResult> {
  logger.info({ companyId }, "[CompanyStorage] calculate start (inventory)");

  const settled = await Promise.allSettled([
    loadMessageItems(companyId),
    loadQuickMessageItems(companyId),
    loadScheduleItems(companyId),
    loadCampaignItems(companyId),
    loadAnnouncementItems(companyId),
    loadFileListItems(companyId),
    loadChatMessageItems(companyId),
    loadFlowImageItems(companyId),
    loadFlowAudioItems(companyId)
  ]);

  const merged: CompanyMediaListItem[] = [];
  settled.forEach((result) => {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    }
  });

  const seen = new Set<string>();
  const bySource: Record<string, { count: number; bytes: number }> = {};
  const byType: Record<CompanyMediaBucket, number> = {
    image: 0,
    video: 0,
    audio: 0,
    document: 0,
    other: 0
  };
  let totalBytes = 0;
  let fileCount = 0;

  for (const item of merged) {
    const key =
      item.storageRel ||
      `${item.source}:${item.fileName}:${item.sizeBytes}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const sz = Number(item.sizeBytes) || 0;
    if (sz <= 0) continue;
    fileCount += 1;
    totalBytes += sz;
    byType[item.type] = (byType[item.type] || 0) + sz;
    if (!bySource[item.source]) {
      bySource[item.source] = { count: 0, bytes: 0 };
    }
    bySource[item.source].count += 1;
    bySource[item.source].bytes += sz;
  }

  for (const [source, stat] of Object.entries(bySource)) {
    logger.info(
      {
        companyId,
        source,
        count: stat.count,
        bytes: Math.round(stat.bytes)
      },
      "[CompanyStorage] source total"
    );
  }

  const result: CompanyMediaTotalResult = {
    totalBytes: Math.round(totalBytes),
    imageBytes: Math.round(byType.image),
    videoBytes: Math.round(byType.video),
    audioBytes: Math.round(byType.audio),
    documentBytes: Math.round(byType.document),
    otherBytes: Math.round(byType.other),
    bySource,
    fileCount
  };

  logger.info(
    {
      companyId,
      totalBytes: result.totalBytes,
      fileCount: result.fileCount,
      sources: Object.keys(bySource)
    },
    "[CompanyStorage] calculate success (inventory)"
  );

  return result;
}

const ListCompanyMediaService = async (
  input: ListCompanyMediaInput
): Promise<{
  items: CompanyMediaListItem[];
  count: number;
  hasMore: boolean;
  summary: {
    totalBytes: number;
    imageBytes: number;
    videoBytes: number;
    audioBytes: number;
    documentBytes: number;
    otherBytes: number;
  };
}> => {
  try {
    const { companyId } = input;
    const { page, limit, offset } = parsePageLimit(input.page, input.limit);
    const typeFilter = parseTypeFilter(input);

    const searchTrim = String(input.search || "").trim();
    let start: Date | null = null;
    let end: Date | null = null;
    if (input.startDate) {
      const t = Date.parse(String(input.startDate));
      if (!Number.isNaN(t)) start = new Date(t);
    }
    if (input.endDate) {
      const t = Date.parse(String(input.endDate));
      if (!Number.isNaN(t)) {
        end = new Date(t);
        end.setHours(23, 59, 59, 999);
      }
    }

    const settled = await Promise.allSettled([
      loadMessageItems(companyId),
      loadQuickMessageItems(companyId),
      loadScheduleItems(companyId),
      loadCampaignItems(companyId),
      loadAnnouncementItems(companyId),
      loadFileListItems(companyId),
      loadChatMessageItems(companyId),
      loadFlowImageItems(companyId),
      loadFlowAudioItems(companyId),
      calculateCompanyMediaTotalBytes(companyId)
    ]);

    const loaderNames = [
      "message",
      "quickMessage",
      "schedule",
      "campaign",
      "announcement",
      "fileList",
      "chatMessage",
      "flowImage",
      "flowAudio",
      "inventoryTotal"
    ] as const;

    settled.forEach((result, i) => {
      if (result.status === "rejected") {
        logger.warn(
          {
            companyId,
            loader: loaderNames[i],
            err:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason)
          },
          "[CompanyMedia] loader rejected"
        );
      }
    });

    const messageItems =
      settled[0].status === "fulfilled" ? settled[0].value : [];
    const quickItems =
      settled[1].status === "fulfilled" ? settled[1].value : [];
    const scheduleItems =
      settled[2].status === "fulfilled" ? settled[2].value : [];
    const campaignItems =
      settled[3].status === "fulfilled" ? settled[3].value : [];
    const announceItems =
      settled[4].status === "fulfilled" ? settled[4].value : [];
    const fileItems =
      settled[5].status === "fulfilled" ? settled[5].value : [];
    const chatItems =
      settled[6].status === "fulfilled" ? settled[6].value : [];
    const fiItems =
      settled[7].status === "fulfilled" ? settled[7].value : [];
    const faItems =
      settled[8].status === "fulfilled" ? settled[8].value : [];
    const inventoryTotal =
      settled[9].status === "fulfilled" ? settled[9].value : null;
    const summary = inventoryTotal
      ? {
          totalBytes: inventoryTotal.totalBytes,
          imageBytes: inventoryTotal.imageBytes,
          videoBytes: inventoryTotal.videoBytes,
          audioBytes: inventoryTotal.audioBytes,
          documentBytes: inventoryTotal.documentBytes,
          otherBytes: inventoryTotal.otherBytes
        }
      : { ...EMPTY_COMPANY_MEDIA_SUMMARY };

    const merged = [
      ...messageItems,
      ...quickItems,
      ...scheduleItems,
      ...campaignItems,
      ...announceItems,
      ...fileItems,
      ...chatItems,
      ...fiItems,
      ...faItems
    ];
    merged.sort((a, b) => safeTimeMs(b.createdAt) - safeTimeMs(a.createdAt));

    const filtered = merged.filter((it) =>
      matchesFilters(it, typeFilter, searchTrim, start, end)
    );

    const sortKey =
      input.sort &&
      ["createdAt_desc", "createdAt_asc", "size_desc", "size_asc"].includes(input.sort)
        ? input.sort
        : "createdAt_desc";
    filtered.sort((a, b) => {
      if (sortKey === "size_desc") {
        const c = b.sizeBytes - a.sizeBytes;
        if (c !== 0) return c;
      }
      if (sortKey === "size_asc") {
        const c = a.sizeBytes - b.sizeBytes;
        if (c !== 0) return c;
      }
      if (sortKey === "createdAt_asc") {
        return safeTimeMs(a.createdAt) - safeTimeMs(b.createdAt);
      }
      return safeTimeMs(b.createdAt) - safeTimeMs(a.createdAt);
    });

    const count = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < count;

    const safeSummary = summary || { ...EMPTY_COMPANY_MEDIA_SUMMARY };

    return {
      items,
      count,
      hasMore,
      summary: {
        totalBytes: Number(safeSummary.totalBytes) || 0,
        imageBytes: Number(safeSummary.imageBytes) || 0,
        videoBytes: Number(safeSummary.videoBytes) || 0,
        audioBytes: Number(safeSummary.audioBytes) || 0,
        documentBytes: Number(safeSummary.documentBytes) || 0,
        otherBytes: Number(safeSummary.otherBytes) || 0
      }
    };
  } catch (err) {
    logger.error(
      {
        companyId: input.companyId,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      },
      "[CompanyMedia] ListCompanyMediaService fatal"
    );
    return {
      items: [],
      count: 0,
      hasMore: false,
      summary: { ...EMPTY_COMPANY_MEDIA_SUMMARY }
    };
  }
};

export default ListCompanyMediaService;
