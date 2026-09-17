import { Request, Response } from "express";
import AppError from "../errors/AppError";
import GroupPreviewParticipantsService from "../services/GroupServices/GroupPreviewParticipantsService";
import GroupExportParticipantsService from "../services/GroupServices/GroupExportParticipantsService";
import GroupImportParticipantsService from "../services/GroupServices/GroupImportParticipantsService";
import GroupOpenConversationService from "../services/GroupServices/GroupOpenConversationService";
import ListGroupsInboxService from "../services/GroupServices/ListGroupsInboxService";
import ListParticipatingGroupsService, {
  assertGroupContactAccessibleForOpen
} from "../services/GroupServices/ListParticipatingGroupsService";
import CreateWhatsAppGroupService from "../services/GroupServices/CreateWhatsAppGroupService";
import JoinWhatsAppGroupService from "../services/GroupServices/JoinWhatsAppGroupService";
import LeaveWhatsAppGroupService from "../services/GroupServices/LeaveWhatsAppGroupService";
import { logger } from "../utils/logger";
import { resolveGroupJidFromBody } from "../helpers/groupParticipantsRequest";

/** Grupos autorizados sem ticket open/pending (aba Atendimento → Grupos). */
export const inbox = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile, supportMode } = req.user;
  const actor = { id: req.user.id, profile, supportMode, companyId };
  const data = await ListGroupsInboxService({ companyId, actor });
  return res.status(200).json(data);
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile, supportMode } = req.user;
  const actor = { id: req.user.id, profile, supportMode, companyId };

  try {
    const data = await ListParticipatingGroupsService({
      whatsappId: Number(whatsappId),
      companyId,
      actor
    });
    return res.status(200).json(data);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.clientMessage ? { message: err.clientMessage } : {})
      });
    }
    logger.error({ err, whatsappId }, "[groups] list failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const create = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId, name, participants } = req.body as {
    whatsappId?: number;
    name?: string;
    participants?: string[];
  };
  const { companyId } = req.user;

  if (!whatsappId || !name?.trim()) {
    throw new AppError("ERR_GROUP_CREATE_PARAMS", 400);
  }
  if (!Array.isArray(participants) || participants.length < 1) {
    throw new AppError("ERR_GROUP_CREATE_PARTICIPANTS", 400);
  }

  try {
    const data = await CreateWhatsAppGroupService({
      companyId,
      whatsappId: Number(whatsappId),
      name,
      participants: participants || []
    });
    return res.status(200).json(data);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.clientMessage ? { message: err.clientMessage } : {})
      });
    }
    logger.error({ err, whatsappId }, "[groups] create failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const join = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, inviteCode } = req.body as {
    whatsappId?: number;
    inviteCode?: string;
  };
  const { companyId } = req.user;

  if (!whatsappId) {
    throw new AppError("ERR_GROUP_WHATSAPP_REQUIRED", 400);
  }

  try {
    const data = await JoinWhatsAppGroupService({
      companyId,
      whatsappId: Number(whatsappId),
      inviteCode: String(inviteCode || "")
    });
    return res.status(200).json(data);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.clientMessage ? { message: err.clientMessage } : {})
      });
    }
    logger.error({ err, whatsappId }, "[groups] join failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const openConversation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId, groupId } = req.body as {
    whatsappId?: number;
    groupId?: string;
  };
  const { companyId, profile, supportMode } = req.user;

  if (!whatsappId || !groupId) {
    throw new AppError("ERR_GROUP_OPEN_PARAMS", 400);
  }

  try {
    const actor = { id: req.user.id, profile, supportMode, companyId };
    await assertGroupContactAccessibleForOpen({
      companyId,
      groupId: String(groupId),
      actor
    });

    const { uuid } = await GroupOpenConversationService({
      companyId,
      whatsappId: Number(whatsappId),
      groupId: String(groupId)
    });
    return res.status(200).json({ uuid });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error({ err, whatsappId }, "[groups] openConversation failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const leave = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId, groupId } = req.body as {
    whatsappId?: number;
    groupId?: string;
  };
  const { companyId } = req.user;

  if (!whatsappId || !groupId) {
    throw new AppError("ERR_GROUP_LEAVE_PARAMS", 400);
  }

  try {
    const data = await LeaveWhatsAppGroupService({
      companyId,
      whatsappId: Number(whatsappId),
      groupId: String(groupId)
    });
    return res.status(200).json(data);
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        ...(err.clientMessage ? { message: err.clientMessage } : {})
      });
    }
    logger.error({ err, whatsappId }, "[groups] leave failed");
    return res.status(500).json({ error: "ERR_INTERNAL_SERVER_ERROR" });
  }
};

export const previewParticipants = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile, supportMode } = req.user;
  const groupJid = resolveGroupJidFromBody(req.body);

  if (!groupJid) {
    throw new AppError("ERR_GROUP_ID_REQUIRED", 400);
  }

  const actor = { id: req.user.id, profile, supportMode, companyId };
  const data = await GroupPreviewParticipantsService({
    companyId,
    whatsappId: Number(whatsappId),
    groupJid,
    actor
  });
  return res.status(200).json(data);
};

export const exportParticipants = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile, supportMode } = req.user;
  const groupJid = resolveGroupJidFromBody(req.body);

  if (!groupJid) {
    throw new AppError("ERR_GROUP_ID_REQUIRED", 400);
  }

  const actor = { id: req.user.id, profile, supportMode, companyId };
  const { filename, csv } = await GroupExportParticipantsService({
    companyId,
    userId: Number(req.user.id),
    whatsappId: Number(whatsappId),
    groupJid,
    actor
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
};

export const importParticipants = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile, supportMode } = req.user;
  const groupJid = resolveGroupJidFromBody(req.body);

  if (!groupJid) {
    throw new AppError("ERR_GROUP_ID_REQUIRED", 400);
  }

  const actor = { id: req.user.id, profile, supportMode, companyId };
  const data = await GroupImportParticipantsService({
    companyId,
    userId: Number(req.user.id),
    whatsappId: Number(whatsappId),
    groupJid,
    actor
  });
  return res.status(200).json(data);
};
