import path from "path";
import { Op } from "sequelize";
import sequelize from "../../database";
import Message from "../../models/Message";
import Chat from "../../models/Chat";
import ChatMessage from "../../models/ChatMessage";
import QuickMessage from "../../models/QuickMessage";
import Schedule from "../../models/Schedule";
import Campaign from "../../models/Campaign";
import Announcement from "../../models/Announcement";
import Files from "../../models/Files";
import FilesOptions from "../../models/FilesOptions";
import { FlowImgModel } from "../../models/FlowImg";
import { FlowAudioModel } from "../../models/FlowAudio";
import { normalizePublicRelPath } from "../../helpers/companyMediaTypes";
import {
  buildMediaPathWhere,
  buildMediaUrlWhere,
  collectPathMatchVariants,
  pathsReferToSameFile
} from "../../helpers/companyMediaDeletePath";
import {
  isChatMessagesTableAvailable,
  isMissingRelationError,
  noteOptionalTableSkipped
} from "../../helpers/optionalTableQuery";
import { logger } from "../../utils/logger";

/**
 * Conta quantos registos apontam para o mesmo ficheiro relativo em `public/`.
 * Usa variantes de path (URL absoluta, /public/, basename) — alinhado à listagem.
 * Tabelas opcionais/legadas ausentes são ignoradas (não propagam erro).
 */
export async function countAllReferencesToRelPath(
  companyId: number,
  relRaw: string | null | undefined,
  warnings?: string[],
  opts: { otherCompanies?: boolean } = {}
): Promise<number> {
  // otherCompanies: conta referências de QUALQUER outra empresa (arquivo compartilhado em public/).
  const cid = opts.otherCompanies ? { [Op.ne]: companyId } : companyId;
  const variants = collectPathMatchVariants(relRaw);
  const r = normalizePublicRelPath(relRaw);
  if (!variants.length && !r) return 0;

  let n = 0;

  const msgWhere = buildMediaUrlWhere(variants);
  if (msgWhere) {
    n += await Message.count({
      where: { companyId: cid, ...msgWhere }
    });
  }

  if (r?.startsWith("quickMessage/")) {
    const inner = r.slice("quickMessage/".length);
    const innerVariants = collectPathMatchVariants(inner);
    const qmWhere = buildMediaPathWhere(innerVariants);
    if (qmWhere) {
      n += await QuickMessage.count({
        where: { companyId: cid, ...qmWhere }
      });
    }
  }

  const pathWhere = buildMediaPathWhere(variants);
  if (pathWhere) {
    n += await Schedule.count({ where: { companyId: cid, ...pathWhere } });
    n += await Campaign.count({ where: { companyId: cid, ...pathWhere } });
    n += await Announcement.count({ where: { companyId: cid, ...pathWhere } });
  }

  if (await isChatMessagesTableAvailable(sequelize, warnings)) {
    try {
      const chatRows = await ChatMessage.findAll({
        where: {
          mediaPath: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] }
        },
        attributes: ["mediaPath"],
        include: [{ model: Chat, where: { companyId: cid }, required: true, attributes: [] }]
      });
      for (const row of chatRows) {
        const mediaPath = row.getDataValue("mediaPath") as string | null;
        if (pathsReferToSameFile(mediaPath, relRaw)) n += 1;
      }
    } catch (err) {
      if (isMissingRelationError(err, "chatmessages")) {
        logger.warn(
          { companyId, err: err instanceof Error ? err.message : String(err) },
          "[CompanyMediaDelete] skipped missing table ChatMessages"
        );
        noteOptionalTableSkipped(warnings, "chatmessages");
      } else {
        throw err;
      }
    }
  }

  const m = /^fileList\/(\d+)\/(.+)$/.exec(r || "");
  if (m) {
    const fileId = Number(m[1]);
    const pth = m[2];
    if (Number.isFinite(fileId) && pth) {
      n += await FilesOptions.count({
        where: { path: pth },
        include: [{ model: Files, where: { companyId: cid, id: fileId }, required: true }]
      });
    }
  }

  if (r) {
    n += await FlowImgModel.count({ where: { companyId: cid, name: r } });
    n += await FlowAudioModel.count({ where: { companyId: cid, name: r } });
  }

  return n;
}
