import fs from "fs";
import path from "path";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import Files from "../../models/Files";
import FilesOptions from "../../models/FilesOptions";
import { FlowImgModel } from "../../models/FlowImg";
import { FlowAudioModel } from "../../models/FlowAudio";
import { getBackendPublicFolder } from "../../helpers/publicFolder";
import { normalizePublicRelPath } from "../../helpers/companyMediaTypes";
import { logger } from "../../utils/logger";

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
 * Soma tamanhos de ficheiros únicos em `public/` associados à empresa.
 * Alinhado à lógica de `SummarizeCompanyMediaBucketsService` (DISTINCT + paths normalizados).
 */
const CalculateCompanyStorageUsageService = async (
  companyId: number
): Promise<number> => {
  try {
    const publicFolder = getBackendPublicFolder();
    const seen = new Set<string>();
    let total = 0;

    const addRel = (rel: string | null | undefined) => {
      const norm = normalizePublicRelPath(rel);
      if (!norm) return;
      const abs = path.isAbsolute(norm) ? norm : path.join(publicFolder, norm);
      const fp = path.normalize(abs);
      if (seen.has(fp)) return;
      seen.add(fp);
      total += safeFileSize(fp);
    };

    const addJoinedRel = (joined: string | null | undefined) => {
      const s = String(joined || "")
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      if (!s || s.startsWith("http://") || s.startsWith("https://")) return;
      const abs = path.join(publicFolder, s);
      const fp = path.normalize(abs);
      if (seen.has(fp)) return;
      seen.add(fp);
      total += safeFileSize(fp);
    };

    const runDistinct = async (sql: string) => {
      try {
        return await sequelize.query(sql, {
          replacements: { cid: companyId },
          type: QueryTypes.SELECT
        });
      } catch (err) {
        logger.warn(
          {
            companyId,
            err: err instanceof Error ? err.message : String(err)
          },
          "[CompanyMedia] calculate storage distinct query failed"
        );
        return [];
      }
    };

    const msgRows = (await runDistinct(`
      SELECT DISTINCT mediaUrl AS mediaUrl FROM Messages
      WHERE companyId = :cid AND mediaUrl IS NOT NULL AND mediaUrl != ''
    `)) as { mediaUrl?: string }[];
    for (const row of msgRows) {
      addRel(row.mediaUrl);
    }

    const quickRows = (await runDistinct(`
      SELECT DISTINCT mediaPath AS mediaPath FROM QuickMessages
      WHERE companyId = :cid AND mediaPath IS NOT NULL AND mediaPath != ''
    `)) as { mediaPath?: string }[];
    for (const row of quickRows) {
      if (row.mediaPath) addJoinedRel(path.join("quickMessage", row.mediaPath));
    }

    const schedRows = (await runDistinct(`
      SELECT DISTINCT mediaPath AS mediaPath FROM Schedules
      WHERE companyId = :cid AND mediaPath IS NOT NULL AND mediaPath != ''
    `)) as { mediaPath?: string }[];
    for (const row of schedRows) {
      addRel(row.mediaPath);
    }

    const campRows = (await runDistinct(`
      SELECT DISTINCT mediaPath AS mediaPath FROM Campaigns
      WHERE companyId = :cid AND mediaPath IS NOT NULL AND mediaPath != ''
    `)) as { mediaPath?: string }[];
    for (const row of campRows) {
      addRel(row.mediaPath);
    }

    const annRows = (await runDistinct(`
      SELECT DISTINCT mediaPath AS mediaPath FROM Announcements
      WHERE companyId = :cid AND mediaPath IS NOT NULL AND mediaPath != ''
    `)) as { mediaPath?: string }[];
    for (const row of annRows) {
      addRel(row.mediaPath);
    }

    try {
      const fileLists = await Files.findAll({
        where: { companyId },
        include: [{ model: FilesOptions, as: "options", required: false }]
      });
      for (const fl of fileLists) {
        const opts = fl.options;
        if (!opts?.length) continue;
        for (const opt of opts) {
          if (opt.path) {
            addJoinedRel(path.join("fileList", String(fl.id), opt.path));
          }
        }
      }
    } catch (err) {
      logger.warn(
        {
          companyId,
          err: err instanceof Error ? err.message : String(err)
        },
        "[CompanyMedia] calculate storage file lists failed"
      );
    }

    const chatRows = (await runDistinct(`
      SELECT DISTINCT cm.mediaPath AS mediaPath
      FROM ChatMessages cm
      INNER JOIN Chats c ON c.id = cm.chatId
      WHERE c.companyId = :cid
        AND cm.mediaPath IS NOT NULL
        AND cm.mediaPath != ''
    `)) as { mediaPath: string }[];
    for (const row of chatRows) {
      addRel(row.mediaPath);
    }

    try {
      const flowImgRows = await FlowImgModel.findAll({
        where: { companyId },
        attributes: ["name"],
        raw: true
      });
      for (const row of flowImgRows as { name?: string }[]) {
        if (row.name) addRel(row.name);
      }
    } catch (err) {
      logger.warn(
        {
          companyId,
          err: err instanceof Error ? err.message : String(err)
        },
        "[CompanyMedia] calculate storage flow img failed"
      );
    }

    try {
      const flowAudioRows = await FlowAudioModel.findAll({
        where: { companyId },
        attributes: ["name"],
        raw: true
      });
      for (const row of flowAudioRows as { name?: string }[]) {
        if (row.name) addRel(row.name);
      }
    } catch (err) {
      logger.warn(
        {
          companyId,
          err: err instanceof Error ? err.message : String(err)
        },
        "[CompanyMedia] calculate storage flow audio failed"
      );
    }

    return Math.round(total);
  } catch (err) {
    logger.error(
      {
        companyId,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      },
      "[CompanyMedia] CalculateCompanyStorageUsageService fatal"
    );
    return 0;
  }
};

export default CalculateCompanyStorageUsageService;
