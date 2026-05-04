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

const MAX_PER_SOURCE = 800;

function statSize(relRaw: string | null | undefined): number {
  const rel = normalizePublicRelPath(relRaw);
  if (!rel) return 0;
  const abs = path.join(getBackendPublicFolder(), rel);
  try {
    const st = fs.statSync(abs);
    return st.isFile() ? st.size : 0;
  } catch {
    return 0;
  }
}

function hrefForRel(rel: string): string {
  const base = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  const enc = rel
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
  const t = new Date(item.createdAt).getTime();
  if (start && t < start.getTime()) return false;
  if (end && t > end.getTime()) return false;
  return true;
}

async function loadMessageItems(companyId: number): Promise<CompanyMediaListItem[]> {
  const rows = await Message.findAll({
    where: {
      companyId,
      mediaUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    attributes: ["id", "mediaUrl", "mediaType", "createdAt", "ticketId"],
    include: [
      { model: Contact, attributes: ["name"], required: false },
      { model: Ticket, attributes: ["id"], required: false }
    ],
    order: [["createdAt", "DESC"]],
    limit: MAX_PER_SOURCE
  });

  return rows.map((msg) => {
    const rel = msg.getDataValue("mediaUrl") as string;
    const mime = (msg.getDataValue("mediaType") as string) || null;
    const base = path.basename(rel || "file");
    const sz = statSize(rel);
    const bucket = classifyMediaBucket(mime, base);
    const c = msg.contact;
    return {
      id: `message:${msg.id}`,
      source: "message" as const,
      sourceId: String(msg.id),
      fileName: base,
      mediaUrl: hrefForRel(normalizePublicRelPath(rel) || rel),
      mimeType: mime,
      type: bucket,
      sizeBytes: sz,
      sizeFormatted: formatBytesPtBr(sz),
      createdAt: new Date(msg.createdAt).toISOString(),
      ticketId: msg.ticketId ?? null,
      contactName: c?.name != null ? String(c.name) : null
    };
  });
}

async function loadQuickMessageItems(companyId: number): Promise<CompanyMediaListItem[]> {
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
    const rel = path.join("quickMessage", inner);
    const name = r.mediaName || inner;
    const sz = statSize(rel);
    const bucket = classifyMediaBucket(null, name);
    return {
      id: `quickMessage:${r.id}`,
      source: "quickMessage" as const,
      sourceId: String(r.id),
      fileName: path.basename(name) || name,
      mediaUrl: hrefForRel(rel),
      mimeType: null,
      type: bucket,
      sizeBytes: sz,
      sizeFormatted: formatBytesPtBr(sz),
      createdAt: new Date(r.createdAt).toISOString(),
      ticketId: null,
      contactName: null
    };
  });
}

async function loadScheduleItems(companyId: number): Promise<CompanyMediaListItem[]> {
  const rows = await Schedule.findAll({
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    attributes: ["id", "mediaPath", "mediaName", "createdAt", "ticketId", "contactId"],
    include: [{ model: Contact, attributes: ["name"], required: false }],
    order: [["updatedAt", "DESC"]],
    limit: MAX_PER_SOURCE
  });
  return rows.map((r) => {
    const rel = String(r.getDataValue("mediaPath") || "");
    const name = r.mediaName || rel;
    const sz = statSize(rel);
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
      sizeBytes: sz,
      sizeFormatted: formatBytesPtBr(sz),
      createdAt: new Date(r.updatedAt || r.createdAt).toISOString(),
      ticketId: r.ticketId ?? null,
      contactName: c?.name != null ? String(c.name) : null
    };
  });
}

async function loadCampaignItems(companyId: number): Promise<CompanyMediaListItem[]> {
  const rows = await Campaign.findAll({
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    attributes: ["id", "mediaPath", "mediaName", "createdAt"],
    order: [["updatedAt", "DESC"]],
    limit: MAX_PER_SOURCE
  });
  return rows.map((r) => {
    const rel = String(r.getDataValue("mediaPath") || "");
    const name = r.mediaName || rel;
    const sz = statSize(rel);
    const bucket = classifyMediaBucket(null, name);
    return {
      id: `campaign:${r.id}`,
      source: "campaign" as const,
      sourceId: String(r.id),
      fileName: path.basename(name) || name,
      mediaUrl: hrefForRel(rel),
      mimeType: null,
      type: bucket,
      sizeBytes: sz,
      sizeFormatted: formatBytesPtBr(sz),
      createdAt: new Date(r.updatedAt || r.createdAt).toISOString(),
      ticketId: null,
      contactName: null
    };
  });
}

async function loadAnnouncementItems(companyId: number): Promise<CompanyMediaListItem[]> {
  const rows = await Announcement.findAll({
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    attributes: ["id", "mediaPath", "createdAt"],
    order: [["updatedAt", "DESC"]],
    limit: MAX_PER_SOURCE
  });
  return rows.map((r) => {
    const rel = String(r.getDataValue("mediaPath") || "");
    const sz = statSize(rel);
    const bucket = classifyMediaBucket(null, rel);
    return {
      id: `announcement:${r.id}`,
      source: "announcement" as const,
      sourceId: String(r.id),
      fileName: path.basename(rel),
      mediaUrl: hrefForRel(rel),
      mimeType: null,
      type: bucket,
      sizeBytes: sz,
      sizeFormatted: formatBytesPtBr(sz),
      createdAt: new Date(r.updatedAt || r.createdAt).toISOString(),
      ticketId: null,
      contactName: null
    };
  });
}

async function loadFileListItems(companyId: number): Promise<CompanyMediaListItem[]> {
  const lists = await Files.findAll({
    where: { companyId },
    include: [{ model: FilesOptions, as: "options", required: true }],
    limit: MAX_PER_SOURCE
  });
  const out: CompanyMediaListItem[] = [];
  for (const fl of lists) {
    const opts = fl.options || [];
    for (const opt of opts) {
      if (!opt.path) continue;
      const rel = path.join("fileList", String(fl.id), opt.path);
      const sz = statSize(rel);
      const bucket = classifyMediaBucket(opt.mediaType, opt.path);
      out.push({
        id: `fileListOption:${opt.id}`,
        source: "fileListOption",
        sourceId: String(opt.id),
        fileName: path.basename(opt.path),
        mediaUrl: hrefForRel(rel),
        mimeType: opt.mediaType ?? null,
        type: bucket,
        sizeBytes: sz,
        sizeFormatted: formatBytesPtBr(sz),
        createdAt: new Date(opt.updatedAt || opt.createdAt).toISOString(),
        ticketId: null,
        contactName: null
      });
    }
  }
  out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return out.slice(0, MAX_PER_SOURCE);
}

async function loadChatMessageItems(companyId: number): Promise<CompanyMediaListItem[]> {
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
    const sz = statSize(rel);
    const bucket = classifyMediaBucket(null, name);
    return {
      id: `chatMessage:${r.id}`,
      source: "chatMessage" as const,
      sourceId: String(r.id),
      fileName: path.basename(name) || name,
      mediaUrl: hrefForRel(rel),
      mimeType: null,
      type: bucket,
      sizeBytes: sz,
      sizeFormatted: formatBytesPtBr(sz),
      createdAt: new Date(r.createdAt).toISOString(),
      ticketId: null,
      contactName: null
    };
  });
}

async function loadFlowImageItems(companyId: number): Promise<CompanyMediaListItem[]> {
  const rows = await FlowImgModel.findAll({
    where: { companyId },
    attributes: ["id", "name", "createdAt"],
    order: [["updatedAt", "DESC"]],
    limit: MAX_PER_SOURCE
  });
  return rows.map((r) => {
    const rel = String(r.name || "");
    const sz = statSize(rel);
    const bucket = classifyMediaBucket("image/png", rel);
    return {
      id: `flowImage:${r.id}`,
      source: "flowImage" as const,
      sourceId: String(r.id),
      fileName: path.basename(rel) || `flow-img-${r.id}`,
      mediaUrl: hrefForRel(rel),
      mimeType: "image/png",
      type: bucket,
      sizeBytes: sz,
      sizeFormatted: formatBytesPtBr(sz),
      createdAt: new Date(r.updatedAt || r.createdAt).toISOString(),
      ticketId: null,
      contactName: null
    };
  });
}

async function loadFlowAudioItems(companyId: number): Promise<CompanyMediaListItem[]> {
  const rows = await FlowAudioModel.findAll({
    where: { companyId },
    attributes: ["id", "name", "createdAt"],
    order: [["updatedAt", "DESC"]],
    limit: MAX_PER_SOURCE
  });
  return rows.map((r) => {
    const rel = String(r.name || "");
    const sz = statSize(rel);
    const bucket = classifyMediaBucket("audio/ogg", rel);
    return {
      id: `flowAudio:${r.id}`,
      source: "flowAudio" as const,
      sourceId: String(r.id),
      fileName: path.basename(rel) || `flow-audio-${r.id}`,
      mediaUrl: hrefForRel(rel),
      mimeType: "audio/ogg",
      type: bucket,
      sizeBytes: sz,
      sizeFormatted: formatBytesPtBr(sz),
      createdAt: new Date(r.updatedAt || r.createdAt).toISOString(),
      ticketId: null,
      contactName: null
    };
  });
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

  const typeFilter: CompanyMediaBucket | "all" =
    input.type &&
    ["image", "video", "audio", "document", "other"].includes(String(input.type))
      ? (input.type as CompanyMediaBucket)
      : "all";

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
  merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const filtered = merged.filter((it) =>
    matchesFilters(it, typeFilter, searchTrim, start, end)
  );

  const sortKey = input.sort || "createdAt_desc";
  filtered.sort((a, b) => {
    if (sortKey === "size_desc") {
      if (b.sizeBytes !== a.sizeBytes) return b.sizeBytes - a.sizeBytes;
    }
    if (sortKey === "size_asc") {
      if (a.sizeBytes !== b.sizeBytes) return a.sizeBytes - b.sizeBytes;
    }
    if (sortKey === "createdAt_asc") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
