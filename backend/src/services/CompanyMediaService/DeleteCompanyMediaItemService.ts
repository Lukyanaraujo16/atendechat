import path from "path";
import sequelize from "../../database";
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
import { unlinkPublicMediaFile } from "../../helpers/companyMediaDeletePath";
import { decrementCompanyStorageUsage } from "../CompanyService/adjustCompanyStorageUsage";
import { isChatMessagesTableAvailable } from "../../helpers/optionalTableQuery";
import { countAllReferencesToRelPath } from "./countAllReferencesToRelPath";

export const MESSAGE_MEDIA_REMOVED_BODY = "[Mídia removida pelo administrador]";
export const MESSAGE_MEDIA_AUTO_REMOVED_BODY =
  "[Mídia removida automaticamente: limite de armazenamento]";

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

export type DeleteCompanyMediaItemResult = {
  freedBytes: number;
  fileMissing: boolean;
};

/** Após remover referências no registo. Devolve bytes libertados do disco. */
async function unlinkAfterClearedReference(
  companyId: number,
  relRaw: string | null | undefined,
  joinedRel: string | null | undefined,
  deferStorageDecrement: boolean,
  fallbackSizeBytes = 0,
  warnings?: string[]
): Promise<DeleteCompanyMediaItemResult> {
  const remaining = await countAllReferencesToRelPath(
    companyId,
    relRaw,
    warnings
  );
  if (remaining > 0) {
    return { freedBytes: 0, fileMissing: false };
  }

  const diskFreed = unlinkPublicMediaFile(relRaw, joinedRel);
  const fileMissing = diskFreed === 0;
  const accounting =
    diskFreed > 0 ? diskFreed : fileMissing ? Math.max(0, fallbackSizeBytes) : 0;

  if (accounting > 0 && !deferStorageDecrement) {
    void decrementCompanyStorageUsage(companyId, accounting);
  }

  return { freedBytes: accounting, fileMissing };
}

export type DeleteCompanyMediaItemOptions = {
  deferStorageDecrement: boolean;
  /** Bytes conhecidos da listagem (ajuste de armazenamento se ficheiro já não existir). */
  knownSizeBytes?: number;
  /** Avisos técnicos acumulados (tabelas opcionais ausentes). */
  warnings?: string[];
  /** Limpeza por cota: preserva o texto/legenda da mensagem e acrescenta o aviso. */
  automaticCleanup?: boolean;
};

/** Elimina uma mídia com a mesma lógica que o DELETE singular; devolve bytes contabilizados. */
export const deleteCompanyMediaItemWithOptions = async (
  companyId: number,
  source: DeleteCompanyMediaSource,
  sourceId: string,
  opts: DeleteCompanyMediaItemOptions
): Promise<DeleteCompanyMediaItemResult> => {
  const defer = opts.deferStorageDecrement;
  const fallbackSize = Math.max(0, Number(opts.knownSizeBytes) || 0);
  const warnings = opts.warnings;

  const finishPhysicalDelete = async (
    relRaw: string,
    joinedRel: string | null,
    refCount: number
  ): Promise<DeleteCompanyMediaItemResult> => {
    let n = refCount;
    if (n < 1) n = 1;
    if (n === 1) {
      return unlinkAfterClearedReference(
        companyId,
        relRaw,
        joinedRel,
        defer,
        fallbackSize,
        warnings
      );
    }
    return { freedBytes: 0, fileMissing: false };
  };

  switch (source) {
    case "message": {
      const msgId = Number(sourceId);
      const msg = await Message.findOne({
        where: Number.isFinite(msgId)
          ? { id: msgId, companyId }
          : { id: sourceId, companyId }
      });
      if (!msg) throw new AppError("ERR_NO_PERMISSION", 404);
      const rel = msg.getDataValue("mediaUrl") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      const currentBody = String(msg.getDataValue("body") || "").trim();
      await msg.update({
        mediaUrl: null as unknown as string,
        mediaType: null as unknown as string,
        body: opts.automaticCleanup
          ? [currentBody, MESSAGE_MEDIA_AUTO_REMOVED_BODY]
              .filter(Boolean)
              .join("\n")
          : MESSAGE_MEDIA_REMOVED_BODY
      });
      return finishPhysicalDelete(rel, null, n);
    }
    case "quickMessage": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await QuickMessage.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_PERMISSION", 404);
      const inner = row.getDataValue("mediaPath") as string | null;
      if (!inner) throw new AppError("ERR_VALIDATION", 400);
      const rel = path.join("quickMessage", inner);
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      await row.update({ mediaPath: null as unknown as string, mediaName: null as unknown as string });
      return finishPhysicalDelete(rel, path.join("quickMessage", inner), n);
    }
    case "schedule": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await Schedule.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
      const rel = row.getDataValue("mediaPath") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      await row.update({ mediaPath: null as unknown as string, mediaName: null as unknown as string });
      return finishPhysicalDelete(rel, null, n);
    }
    case "campaign": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await Campaign.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_CAMPAIGN_NOT_FOUND", 404);
      const rel = row.getDataValue("mediaPath") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      await row.update({ mediaPath: null as unknown as string, mediaName: null as unknown as string });
      return finishPhysicalDelete(rel, null, n);
    }
    case "announcement": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await Announcement.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_ANNOUNCEMENT_FOUND", 404);
      const rel = row.getDataValue("mediaPath") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      await row.update({
        mediaPath: null as unknown as string,
        mediaName: null as unknown as string
      });
      return finishPhysicalDelete(rel, null, n);
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
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      await opt.destroy();
      return finishPhysicalDelete(rel, rel, n);
    }
    case "chatMessage": {
      if (!(await isChatMessagesTableAvailable(sequelize, warnings))) {
        throw new AppError("ERR_NO_PERMISSION", 404);
      }
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await ChatMessage.findOne({
        where: { id },
        include: [{ model: Chat, where: { companyId }, required: true }]
      });
      if (!row) throw new AppError("ERR_NO_PERMISSION", 404);
      const rel = row.getDataValue("mediaPath") as string | null;
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      await row.update({
        mediaPath: "" as unknown as string,
        mediaName: null as unknown as string,
        message: MESSAGE_MEDIA_REMOVED_BODY
      });
      return finishPhysicalDelete(rel, null, n);
    }
    case "flowImage": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await FlowImgModel.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_PERMISSION", 404);
      const rel = String(row.name || "");
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      await row.destroy();
      return finishPhysicalDelete(rel, null, n);
    }
    case "flowAudio": {
      const id = Number(sourceId);
      if (!Number.isFinite(id)) throw new AppError("ERR_VALIDATION", 400);
      const row = await FlowAudioModel.findOne({ where: { id, companyId } });
      if (!row) throw new AppError("ERR_NO_PERMISSION", 404);
      const rel = String(row.name || "");
      if (!rel) throw new AppError("ERR_VALIDATION", 400);
      const n = await countAllReferencesToRelPath(companyId, rel, warnings);
      await row.destroy();
      return finishPhysicalDelete(rel, null, n);
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
