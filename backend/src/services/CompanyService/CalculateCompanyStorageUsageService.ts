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

function safeFileSize(absPath: string): number {
  try {
    const st = fs.statSync(absPath);
    if (st.isFile()) return st.size;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Soma tamanhos de ficheiros únicos em `public/` associados à empresa (mensagens, listas, campanhas, etc.).
 */
const CalculateCompanyStorageUsageService = async (
  companyId: number
): Promise<number> => {
  const publicFolder = getBackendPublicFolder();
  const seen = new Set<string>();
  let total = 0;

  const addRel = (rel: string | null | undefined) => {
    if (rel == null) return;
    const s = String(rel).trim();
    if (!s || s.startsWith("http://") || s.startsWith("https://")) return;
    const abs = path.isAbsolute(s) ? s : path.join(publicFolder, s);
    const norm = path.normalize(abs);
    if (seen.has(norm)) return;
    seen.add(norm);
    total += safeFileSize(norm);
  };

  const distinctMessageUrls = await Message.findAll({
    attributes: ["mediaUrl"],
    where: {
      companyId,
      mediaUrl: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    group: ["mediaUrl"],
    raw: true
  });
  for (const row of distinctMessageUrls as { mediaUrl?: string }[]) {
    addRel(row.mediaUrl);
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
    if (row.mediaPath) addRel(path.join("quickMessage", row.mediaPath));
  }

  const distinctSchedules = await Schedule.findAll({
    attributes: ["mediaPath"],
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    group: ["mediaPath"],
    raw: true
  });
  for (const row of distinctSchedules as { mediaPath?: string }[]) {
    addRel(row.mediaPath);
  }

  const distinctCampaigns = await Campaign.findAll({
    attributes: ["mediaPath"],
    where: {
      companyId,
      mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
    },
    group: ["mediaPath"],
    raw: true
  });
  for (const row of distinctCampaigns as { mediaPath?: string }[]) {
    addRel(row.mediaPath);
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
    addRel(row.mediaPath);
  }

  const fileLists = await Files.findAll({
    where: { companyId },
    include: [
      { model: FilesOptions, as: "options", required: false }
    ]
  });
  for (const fl of fileLists) {
    const opts = fl.options;
    if (!opts?.length) continue;
    for (const opt of opts) {
      if (opt.path) {
        addRel(path.join("fileList", String(fl.id), opt.path));
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
    addRel(row.mediaPath);
  }

  const flowImgRows = await FlowImgModel.findAll({
    where: { companyId },
    attributes: ["name"],
    raw: true
  });
  for (const row of flowImgRows as { name?: string }[]) {
    if (row.name) addRel(row.name);
  }

  const flowAudioRows = await FlowAudioModel.findAll({
    where: { companyId },
    attributes: ["name"],
    raw: true
  });
  for (const row of flowAudioRows as { name?: string }[]) {
    if (row.name) addRel(row.name);
  }

  return total;
};

export default CalculateCompanyStorageUsageService;
