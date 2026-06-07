import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import ListStickersService from "../services/StickerServices/ListStickersService";
import CreateStickerService from "../services/StickerServices/CreateStickerService";
import DeleteStickerService from "../services/StickerServices/DeleteStickerService";
import SendStickerToTicketService from "../services/StickerServices/SendStickerToTicketService";
import { canManageStickerLibrary } from "../helpers/stickerStorage";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { stickers } = await ListStickersService({ companyId });
  return res.json({
    stickers: stickers.map(s => ({
      ...s.get({ plain: true }),
      publicUrl: s.publicUrl
    }))
  });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, id: userId, profile } = req.user;

  if (!canManageStickerLibrary(profile)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const file = req.file;
  if (!file) {
    throw new AppError("ERR_STICKER_FILE_REQUIRED", 400);
  }

  const { name } = req.body as { name?: string };

  try {
    const sticker = await CreateStickerService({
      companyId,
      userId: Number(userId),
      file,
      name
    });

    const io = getIO();
    io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-sticker`, {
      action: "create",
      sticker: {
        ...sticker.get({ plain: true }),
        publicUrl: sticker.publicUrl
      }
    });

    return res.status(200).json({
      ...sticker.get({ plain: true }),
      publicUrl: sticker.publicUrl
    });
  } catch (err: any) {
    if (err?.message === "STICKER_WEBP_ONLY") {
      throw new AppError("STICKER_WEBP_ONLY", 400);
    }
    throw err;
  }
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, profile } = req.user;
  const { stickerId } = req.params;

  if (!canManageStickerLibrary(profile)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await DeleteStickerService({
    id: Number(stickerId),
    companyId
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-sticker`, {
    action: "delete",
    stickerId: Number(stickerId)
  });

  return res.status(200).json({ success: true });
};

export const sendToTicket = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { stickerId } = req.body as { stickerId?: number };
  const { companyId, profile, supportMode, id } = req.user;

  if (!stickerId) {
    throw new AppError("ERR_STICKER_ID_REQUIRED", 400);
  }

  const { message } = await SendStickerToTicketService({
    stickerId: Number(stickerId),
    ticketId,
    companyId,
    actor: { id, profile, supportMode }
  });

  return res.status(200).json({ message });
};
