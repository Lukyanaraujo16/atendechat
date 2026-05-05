import fs from "fs";
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
import { getBackendPublicFolder } from "../../helpers/publicFolder";
import { formatBytesPtBr } from "../../helpers/companyStorage";
import {
  classifyMediaBucket,
  CompanyMediaBucket,
  CompanyMediaSource,
  normalizePublicRelPath
} from "../../helpers/companyMediaTypes";
import SummarizeCompanyMediaBucketsService from "./SummarizeCompanyMediaBucketsService";
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
  logMeta: { source: CompanyMediaSource; sourceId?: string }
): { sizeBytes: number; missing: boolean } {
  const norm = normalizePublicRelPath(relRaw);
  if (!norm) {
    return { sizeBytes: 0, missing: false };
  }
  const abs = path.join(getBackendPublicFolder(), norm);
  try {
    const st = fs.statSync(abs);
    if (!st.isFile()) {
      logger.warn(
        { ...logMeta, file: path.basename(norm) },
        "[CompanyMedia] missing media file"
      );
      return { sizeBytes: 0, missing: true };
    }
    return { sizeBytes: st.size, missing: false };
  } catch {
    logger.warn(
      { ...logMeta, file: path.basename(norm) },
      "[CompanyMedia] missing media file"
    );
    return { sizeBytes: 0, missing: true };
  }
}

/** Caminho relativo sob public/ (sem URL absoluta exposta). */
function statSizeForJoinedRel(
  relJoined: string,
  logMeta: { source: CompanyMediaSource; sourceId?: string }
): { sizeBytes: number; missing: boolean } {
  const s = String(relJoined || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!s) {
    return { sizeBytes: 0, missing: true };
  }
  const abs = path.join(getBackendPublicFolder(), s);
  try {
    const st = fs.statSync(abs);
    if (!st.isFile()) {
      logger.warn(
        { ...logMeta, file: path.basename(s) },
        "[CompanyMedia] missing media file"
      );
      return { sizeBytes: 0, missing: true };
    }
    return { sizeBytes: st.size, missing: false };
  } catch {
    logger.warn(
      { ...logMeta, file: path.basename(s) },
      "[CompanyMedia] missing media file"
    );
    return { sizeBytes: 0, missing: true };
  }
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

function parsePageLimit(page?: number, limit?: number): { page: number; limit: number; offset: number } {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 25));
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
        const { sizeBytes, missing } = safeStatRel(rel, {
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
          missing
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
      const { sizeBytes, missing } = statSizeForJoinedRel(relJoined, {
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
        missing
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
      const { sizeBytes, missing } = safeStatRel(rel, {
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
        missing
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
      const { sizeBytes, missing } = safeStatRel(rel, {
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
        missing
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
      const { sizeBytes, missing } = safeStatRel(rel, {
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
        missing
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
          const { sizeBytes, missing } = statSizeForJoinedRel(relJoined, {
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
            missing
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
      const { sizeBytes, missing } = safeStatRel(rel, {
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
        missing
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
      const { sizeBytes, missing } = safeStatRel(rel, {
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
        missing
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
      const { sizeBytes, missing } = safeStatRel(rel, {
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
        missing
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

  const [
    messageItems,
    quickItems,
    scheduleItems,
    campaignItems,
    announceItems,
    fileItems,
    chatItems,
    fiItems,
    faItems,
    summary
  ] = await Promise.all([
    loadMessageItems(companyId),
    loadQuickMessageItems(companyId),
    loadScheduleItems(companyId),
    loadCampaignItems(companyId),
    loadAnnouncementItems(companyId),
    loadFileListItems(companyId),
    loadChatMessageItems(companyId),
    loadFlowImageItems(companyId),
    loadFlowAudioItems(companyId),
    SummarizeCompanyMediaBucketsService(companyId)
  ]);

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

  const sortKey = input.sort || "createdAt_desc";
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

  return {
    items,
    count,
    hasMore,
    summary: {
      totalBytes: summary.totalBytes,
      imageBytes: summary.imageBytes,
      videoBytes: summary.videoBytes,
      audioBytes: summary.audioBytes,
      documentBytes: summary.documentBytes,
      otherBytes: summary.otherBytes
    }
  };
};

export default ListCompanyMediaService;
