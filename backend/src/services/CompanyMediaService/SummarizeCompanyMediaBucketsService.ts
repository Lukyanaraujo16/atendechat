import fs from "fs";
import path from "path";
import { QueryTypes } from "sequelize";
import sequelize from "../../database";
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
import { logger } from "../../utils/logger";

export const EMPTY_COMPANY_MEDIA_SUMMARY = {
  totalBytes: 0,
  imageBytes: 0,
  videoBytes: 0,
  audioBytes: 0,
  documentBytes: 0,
  otherBytes: 0
};

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
 * Nunca lança: dados inconsistentes ou SQL frágil devolvem zeros e logam [CompanyMedia].
 */
const SummarizeCompanyMediaBucketsService = async (
  companyId: number
): Promise<typeof EMPTY_COMPANY_MEDIA_SUMMARY> => {
  try {
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
      try {
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
      } catch {
        /* item ignorado */
      }
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
          "[CompanyMedia] summary distinct query failed"
        );
        return [];
      }
    };

    const distinctMessageUrls = (await runDistinct(`
      SELECT DISTINCT mediaUrl AS mediaUrl, mediaType AS mediaType
      FROM Messages
      WHERE companyId = :cid
        AND mediaUrl IS NOT NULL
        AND mediaUrl != ''
    `)) as { mediaUrl?: string; mediaType?: string }[];
    for (const row of distinctMessageUrls) {
      addRel(row.mediaUrl, row.mediaType ?? null);
    }

    const distinctQuick = (await runDistinct(`
      SELECT DISTINCT mediaPath AS mediaPath
      FROM QuickMessages
      WHERE companyId = :cid
        AND mediaPath IS NOT NULL
        AND mediaPath != ''
    `)) as { mediaPath?: string }[];
    for (const row of distinctQuick) {
      if (row.mediaPath) addRel(path.join("quickMessage", row.mediaPath), null);
    }

    const distinctSchedules = (await runDistinct(`
      SELECT DISTINCT mediaPath AS mediaPath, mediaName AS mediaName
      FROM Schedules
      WHERE companyId = :cid
        AND mediaPath IS NOT NULL
        AND mediaPath != ''
    `)) as { mediaPath?: string }[];
    for (const row of distinctSchedules) {
      addRel(row.mediaPath, null);
    }

    const distinctCampaigns = (await runDistinct(`
      SELECT DISTINCT mediaPath AS mediaPath, mediaName AS mediaName
      FROM Campaigns
      WHERE companyId = :cid
        AND mediaPath IS NOT NULL
        AND mediaPath != ''
    `)) as { mediaPath?: string }[];
    for (const row of distinctCampaigns) {
      addRel(row.mediaPath, null);
    }

    const distinctAnnouncements = (await runDistinct(`
      SELECT DISTINCT mediaPath AS mediaPath
      FROM Announcements
      WHERE companyId = :cid
        AND mediaPath IS NOT NULL
        AND mediaPath != ''
    `)) as { mediaPath?: string }[];
    for (const row of distinctAnnouncements) {
      addRel(row.mediaPath, null);
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
            addRel(
              path.join("fileList", String(fl.id), opt.path),
              opt.mediaType ?? null
            );
          }
        }
      }
    } catch (err) {
      logger.warn(
        {
          companyId,
          err: err instanceof Error ? err.message : String(err)
        },
        "[CompanyMedia] summary file lists failed"
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
      addRel(row.mediaPath, null);
    }

    try {
      const flowImgRows = await FlowImgModel.findAll({
        where: { companyId },
        attributes: ["name"],
        raw: true
      });
      for (const row of flowImgRows as { name?: string }[]) {
        if (row.name) addRel(row.name, "image/png");
      }
    } catch (err) {
      logger.warn(
        {
          companyId,
          err: err instanceof Error ? err.message : String(err)
        },
        "[CompanyMedia] summary flow images failed"
      );
    }

    try {
      const flowAudioRows = await FlowAudioModel.findAll({
        where: { companyId },
        attributes: ["name"],
        raw: true
      });
      for (const row of flowAudioRows as { name?: string }[]) {
        if (row.name) addRel(row.name, "audio/ogg");
      }
    } catch (err) {
      logger.warn(
        {
          companyId,
          err: err instanceof Error ? err.message : String(err)
        },
        "[CompanyMedia] summary flow audio failed"
      );
    }

    return {
      totalBytes: Math.round(sums.total),
      imageBytes: Math.round(sums.image),
      videoBytes: Math.round(sums.video),
      audioBytes: Math.round(sums.audio),
      documentBytes: Math.round(sums.document),
      otherBytes: Math.round(sums.other)
    };
  } catch (err) {
    logger.error(
      {
        companyId,
        err: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined
      },
      "[CompanyMedia] summary aborted"
    );
    return { ...EMPTY_COMPANY_MEDIA_SUMMARY };
  }
};

export default SummarizeCompanyMediaBucketsService;
