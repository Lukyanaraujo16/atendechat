import { QueryTypes } from "sequelize";
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
import { normalizePublicRelPath } from "../../helpers/companyMediaTypes";

/**
 * Conta quantos registos apontam para o mesmo ficheiro relativo em `public/`.
 * Usado para decidir se o ficheiro físico pode ser apagado sem partir outras referências.
 */
export async function countAllReferencesToRelPath(
  companyId: number,
  relRaw: string | null | undefined
): Promise<number> {
  const r = normalizePublicRelPath(relRaw);
  if (!r) return 0;
  let n = 0;

  n += await Message.count({
    where: { companyId, mediaUrl: r }
  });

  if (r.startsWith("quickMessage/")) {
    const inner = r.slice("quickMessage/".length);
    n += await QuickMessage.count({
      where: { companyId, mediaPath: inner }
    });
  }

  n += await Schedule.count({ where: { companyId, mediaPath: r } });
  n += await Campaign.count({ where: { companyId, mediaPath: r } });
  n += await Announcement.count({ where: { companyId, mediaPath: r } });

  const chatRows = await sequelize.query<{ c: string }>(
    `
    SELECT COUNT(*)::text AS c
    FROM ChatMessages cm
    INNER JOIN Chats c ON c.id = cm.chatId
    WHERE c.companyId = :cid
      AND cm.mediaPath = :mp
      AND cm.mediaPath IS NOT NULL
      AND cm.mediaPath != ''
    `,
    { replacements: { cid: companyId, mp: r }, type: QueryTypes.SELECT }
  );
  n += Number((chatRows[0] as { c: string })?.c || 0);

  const m = /^fileList\/(\d+)\/(.+)$/.exec(r);
  if (m) {
    const fileId = Number(m[1]);
    const pth = m[2];
    if (Number.isFinite(fileId) && pth) {
      n += await FilesOptions.count({
        where: { path: pth },
        include: [{ model: Files, where: { companyId, id: fileId }, required: true }]
      });
    }
  }

  n += await FlowImgModel.count({ where: { companyId, name: r } });
  n += await FlowAudioModel.count({ where: { companyId, name: r } });

  return n;
}
