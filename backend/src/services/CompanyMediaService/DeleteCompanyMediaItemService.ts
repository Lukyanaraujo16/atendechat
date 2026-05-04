import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import Message from "../../models/Message";
import QuickMessage from "../../models/QuickMessage";
import Schedule from "../../models/Schedule";
import Campaign from "../../models/Campaign";
import Announcement from "../../models/Announcement";
import FilesOptions from "../../models/FilesOptions";
import Files from "../../models/Files";
import ChatMessage from "../../models/ChatMessage";
import Chat from "../../models/Chat";
import { FlowImgModel } from "../../models/FlowImg";
import { FlowAudioModel } from "../../models/FlowAudio";
import { getBackendPublicFolder } from "../../helpers/publicFolder";
import { normalizePublicRelPath } from "../../helpers/companyMediaTypes";
import {
  decrementCompanyStorageUsage,
  tryStatFileBytes
} from "../CompanyService/adjustCompanyStorageUsage";
import { countAllReferencesToRelPath } from "./countAllReferencesToRelPath";

export const MESSAGE_MEDIA_REMOVED_BODY = "[Mídia removida pelo administrador]";

export type DeleteCompanyMediaSource =
  | "message"
  | "quickMessage"
  | "schedule"
  | "campaign"
  | "announcement"
  | "fileListOption"
  | "chatMessage"
  | "flowImage"
  | "flowAudio";

/** Após remover referências no registo. Devolve bytes libertados do disco (0 se ficheiro não existir / ainda referenciado). */
async function unlinkAfterClearedReference(
  companyId: number,
  relRaw: string | null | undefined,
  deferStorageDecrement = false
): Promise<number> {
  const r = normalizePublicRelPath(relRaw);
  if (!r) return 0;
  const n = await countAllReferencesToRelPath(companyId, r);
  if (n !== 0) return 0;
  const abs = path.join(getBackendPublicFolder(), r);
  if (fs.existsSync(abs)) {
    const sz = tryStatFileBytes(abs);
    fs.unlinkSync(abs);
    if (!deferStorageDecrement) {
      void decrementCompanyStorageUsage(companyId, sz);
    }
    return sz;
  }
  return 0;
}

export type DeleteCompanyMediaItemOptions = {
  deferStorageDecrement: boolean;
};

/** Elimina uma mídia com a mesma lógica que o DELETE singular; devolve bytes libertados do disco nesta operação. */
export const deleteCompanyMediaItemWithOptions = async (
  companyId: number,
  source: DeleteCompanyMediaSource,
  sourceId: string,
  opts: DeleteCompanyMediaItemOptions
): Promise<number> => {
  const defer = opts.deferStorageDecrement;
  switch (source) {
    case "message": {
      const msg = await Message.findOne({
        where: { id: sourceId, companyId }
      });
      if (!msg) throw new AppError("ERR_NO_PERMISSION", 404);
      const rel = msg.getDataValue("mediaUrl") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel);
      if (n < 1) throw new AppError("ERR_VALIDATION", 400);
      const shouldUnlink = n === 1;
      await msg.update({
        mediaUrl: null as unknown as string,
        mediaType: null as unknown as string,
        body: MESSAGE_MEDIA_REMOVED_BODY
      });
      if (shouldUnlink) {
        return unlinkAfterClearedReference(companyId, rel, defer);
      }
      return 0;
    }
    case "quickMessage": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await QuickMessage.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_PERMISSION", 404);
      const inner = row.getDataValue("mediaPath") as string | null;
      if (!inner) throw new AppError("ERR_VALIDATION", 400);
      const rel = path.join("quickMessage", inner);
      const n = await countAllReferencesToRelPath(companyId, rel);
      const shouldUnlink = n === 1;
      await row.update({ mediaPath: null as unknown as string, mediaName: null as unknown as string });
      if (shouldUnlink) return unlinkAfterClearedReference(companyId, rel, defer);
      return 0;
    }
    case "schedule": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await Schedule.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
      const rel = row.getDataValue("mediaPath") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel);
      const shouldUnlink = n === 1;
      await row.update({ mediaPath: null as unknown as string, mediaName: null as unknown as string });
      if (shouldUnlink) return unlinkAfterClearedReference(companyId, rel, defer);
      return 0;
    }
    case "campaign": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await Campaign.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_CAMPAIGN_NOT_FOUND", 404);
      const rel = row.getDataValue("mediaPath") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel);
      const shouldUnlink = n === 1;
      await row.update({ mediaPath: null as unknown as string, mediaName: null as unknown as string });
      if (shouldUnlink) return unlinkAfterClearedReference(companyId, rel, defer);
      return 0;
    }
    case "announcement": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await Announcement.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_ANNOUNCEMENT_FOUND", 404);
      const rel = row.getDataValue("mediaPath") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel);
      const shouldUnlink = n === 1;
      await row.update({
        mediaPath: null as unknown as string,
        mediaName: null as unknown as string
      });
      if (shouldUnlink) return unlinkAfterClearedReference(companyId, rel, defer);
      return 0;
    }
    case "fileListOption": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const opt = await FilesOptions.findOne({
        where: { id },
        include: [{ model: Files, as: "file", where: { companyId }, required: true }]
      });
      if (!opt) throw new AppError("ERR_NO_FILE_FOUND", 404);
      const rel = path.join("fileList", String(opt.fileId), opt.path);
      const n = await countAllReferencesToRelPath(companyId, rel);
      const shouldUnlink = n === 1;
      await opt.destroy();
      if (shouldUnlink) return unlinkAfterClearedReference(companyId, rel, defer);
      return 0;
    }
    case "chatMessage": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await ChatMessage.findOne({
        where: { id },
        include: [{ model: Chat, where: { companyId }, required: true }]
      });
      if (!row) throw new AppError("ERR_NO_PERMISSION", 404);
      const rel = row.getDataValue("mediaPath") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel);
      const shouldUnlink = n === 1;
      await row.update({
        mediaPath: "" as unknown as string,
        mediaName: null as unknown as string,
        message: MESSAGE_MEDIA_REMOVED_BODY
      });
      if (shouldUnlink) return unlinkAfterClearedReference(companyId, rel, defer);
      return 0;
    }
    case "flowImage": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await FlowImgModel.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_PERMISSION", 404);
      const rel = String(row.name || "");
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel);
      const shouldUnlink = n === 1;
      await row.destroy();
      if (shouldUnlink) return unlinkAfterClearedReference(companyId, rel, defer);
      return 0;
    }
    case "flowAudio": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await FlowAudioModel.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_PERMISSION", 404);
      const rel = String(row.name || "");
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel);
      const shouldUnlink = n === 1;
      await row.destroy();
      if (shouldUnlink) return unlinkAfterClearedReference(companyId, rel, defer);
      return 0;
    }
    default:
      throw new AppError("ERR_VALIDATION", 400);
  }
};

const DeleteCompanyMediaItemService = async (
  companyId: number,
  source: DeleteCompanyMediaSource,
  sourceId: string
): Promise<void> => {
  await deleteCompanyMediaItemWithOptions(companyId, source, sourceId, {
    deferStorageDecrement: false
  });
};

export default DeleteCompanyMediaItemService;
