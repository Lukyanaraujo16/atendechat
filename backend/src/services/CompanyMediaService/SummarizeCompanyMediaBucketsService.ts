import fs from "fs";
import path from "path";
import { Op, QueryTypes } from "sequelize";
import sequelize from "../../database";
import Message from "../../models/Message";
import QuickMessage from "../../models/QuickMessage";
import Schedule from "../../models/Schedule";
import Campaign from "../../models/Campaign";
import Announcement from "../../models/Announcement";
import Files from "../../models/Files";
import FilesOptions from "../../models/FilesOptions";
import { FlowImgModel } from "../../models/FlowImg";
import { FlowAudioModel } from "../../models/FlowAudio";
import { getBackendPublicFolder } from "../../helpers/publicFolder";
import {
  classifyMediaBucket,
  CompanyMediaBucket,
  normalizePublicRelPath
} from "../../helpers/companyMediaTypes";

function safeFileSize(absPath: string): number {
  try {
    const st = fs.statSync(absPath);
    if (st.isFile()) return st.size;
    return 0;
  } catch {
    return 0;
  }
}

function bumpBucket(
  sums: Record<CompanyMediaBucket | "total", number>,
  bucket: CompanyMediaBucket,
  sz: number
): void {
  sums[bucket] += sz;
  sums.total += sz;
}

/**
 * Agrega bytes por tipo (extensão / mime quando disponível) para todas as mídias em `public/`
 * associadas à empresa — mesma cobertura que `CalculateCompanyStorageUsageService`.
 */
const SummarizeCompanyMediaBucketsService = async (
  companyId: number
): Promise<{
  totalBytes: number;
  imageBytes: number;
  videoBytes: number;
  audioBytes: number;
  documentBytes: number;
  otherBytes: number;
}> => {
  const publicFolder = getBackendPublicFolder();
  const seen = new Set<string>();
  const sums: Record<CompanyMediaBucket | "total", number> = {
    total: 0,
    image: 0,
    video: 0,
    audio: 0,
    document: 0,
    other: 0
  };

  const addRel = (
    rel: string | null | undefined,
    mimeHint: string | null | undefined
  ) => {
    const norm = normalizePublicRelPath(rel);
    if (!norm) return;
    const abs = path.isAbsolute(norm) ? norm : path.join(publicFolder, norm);
    const fp = path.normalize(abs);
    if (seen.has(fp)) return;
    seen.add(fp);
    const sz = safeFileSize(fp);
    if (sz <= 0) return;
    const base = path.basename(norm);
    const bucket = classifyMediaBucket(mimeHint, base);
    bumpBucket(sums, bucket, sz);
  };

  const distinctMessageUrls = await Message.findAll({
    attributes: ["mediaUrl", "mediaType"],
    where: {
      companyId,
      mediaUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    group: ["mediaUrl", "mediaType"],
    raw: true
  });
  for (const row of distinctMessageUrls as { mediaUrl?: string; mediaType?: string }[]) {
    addRel(row.mediaUrl, row.mediaType ?? null);
  }

  const distinctQuick = await QuickMessage.findAll({
    attributes: ["mediaPath"],
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    group: ["mediaPath"],
    raw: true
  });
  for (const row of distinctQuick as { mediaPath?: string }[]) {
    if (row.mediaPath) addRel(path.join("quickMessage", row.mediaPath), null);
  }

  const distinctSchedules = await Schedule.findAll({
    attributes: ["mediaPath", "mediaName"],
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    group: ["mediaPath", "mediaName"],
    raw: true
  });
  for (const row of distinctSchedules as { mediaPath?: string; mediaName?: string }[]) {
    addRel(row.mediaPath, null);
  }

  const distinctCampaigns = await Campaign.findAll({
    attributes: ["mediaPath", "mediaName"],
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    group: ["mediaPath", "mediaName"],
    raw: true
  });
  for (const row of distinctCampaigns as { mediaPath?: string; mediaName?: string }[]) {
    addRel(row.mediaPath, null);
  }

  const distinctAnnouncements = await Announcement.findAll({
    attributes: ["mediaPath"],
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    group: ["mediaPath"],
    raw: true
  });
  for (const row of distinctAnnouncements as { mediaPath?: string }[]) {
    addRel(row.mediaPath, null);
  }

  const fileLists = await Files.findAll({
    where: { companyId },
    include: [{ model: FilesOptions, as: "options", required: false }]
  });
  for (const fl of fileLists) {
    const opts = fl.options;
    if (!opts?.length) continue;
    for (const opt of opts) {
      if (opt.path) {
        addRel(path.join("fileList", String(fl.id), opt.path), opt.mediaType ?? null);
      }
    }
  }

  const chatRows = await sequelize.query<{ mediaPath: string }>(
    `
    SELECT DISTINCT cm.mediaPath AS mediaPath
    FROM ChatMessages cm
    INNER JOIN Chats c ON c.id = cm.chatId
    WHERE c.companyId = :cid
      AND cm.mediaPath IS NOT NULL
      AND cm.mediaPath != ''
    `,
    { replacements: { cid: companyId }, type: QueryTypes.SELECT }
  );
  for (const row of chatRows) {
    addRel(row.mediaPath, null);
  }

  const flowImgRows = await FlowImgModel.findAll({
    where: { companyId },
    attributes: ["name"],
    raw: true
  });
  for (const row of flowImgRows as { name?: string }[]) {
    if (row.name) addRel(row.name, "image/png");
  }

  const flowAudioRows = await FlowAudioModel.findAll({
    where: { companyId },
    attributes: ["name"],
    raw: true
  });
  for (const row of flowAudioRows as { name?: string }[]) {
    if (row.name) addRel(row.name, "audio/ogg");
  }

  return {
    totalBytes: Math.round(sums.total),
    imageBytes: Math.round(sums.image),
    videoBytes: Math.round(sums.video),
    audioBytes: Math.round(sums.audio),
    documentBytes: Math.round(sums.document),
    otherBytes: Math.round(sums.other)
  };
};

export default SummarizeCompanyMediaBucketsService;
