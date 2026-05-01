import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import AppError from "../errors/AppError";

import CreateService from "../services/ScheduleServices/CreateService";
import ListService from "../services/ScheduleServices/ListService";
import UpdateService from "../services/ScheduleServices/UpdateService";
import ShowService from "../services/ScheduleServices/ShowService";
import DeleteService from "../services/ScheduleServices/DeleteService";
import Schedule from "../models/Schedule";
import path from "path";
import fs from "fs";
import { head } from "lodash";
import { logger } from "../utils/logger";
import {
  incrementCompanyStorageUsage,
  decrementCompanyStorageUsage,
  tryStatFileBytes
} from "../services/CompanyService/adjustCompanyStorageUsage";

type IndexQuery = {
  searchParam?: string;
  contactId?: number | string;
  userId?: number | string;
  pageNumber?: string | number;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, userId, pageNumber, searchParam } = req.query as IndexQuery;
  const { companyId } = req.user;

  try {
    const { schedules, count, hasMore } = await ListService({
      searchParam,
      contactId,
      userId,
      pageNumber,
      companyId
    });

    return res.json({ schedules, count, hasMore });
  } catch (err) {
    logger.error(
      { err, companyId, query: req.query },
      "[schedules] GET /schedules listagem falhou"
    );
    throw err;
  }
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    body,
    sendAt,
    contactId,
    contactIds,
    userId,
    preferredWhatsappId,
    scheduleType,
    recurrenceType,
    recurrenceDaysOfWeek,
    recurrenceDayOfMonth,
    timeToSend
  } = req.body;
  const { companyId } = req.user;

  const schedule = await CreateService({
    body,
    sendAt,
    contactId,
    contactIds,
    companyId,
    userId,
    preferredWhatsappId:
      preferredWhatsappId === "" || preferredWhatsappId === undefined
        ? null
        : Number(preferredWhatsappId),
    scheduleType,
    recurrenceType,
    recurrenceDaysOfWeek,
    recurrenceDayOfMonth,
    timeToSend
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit("schedule", {
    action: "create",
    schedule
  });

  return res.status(200).json(schedule);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  const schedule = await ShowService(scheduleId, companyId);

  return res.status(200).json(schedule);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { scheduleId } = req.params;
  const scheduleData: any = { ...req.body };
  const { companyId } = req.user;

  if (scheduleData.preferredWhatsappId !== undefined) {
    scheduleData.preferredWhatsappId =
      scheduleData.preferredWhatsappId === "" ||
      scheduleData.preferredWhatsappId === null
        ? null
        : Number(scheduleData.preferredWhatsappId);
  }

  const schedule = await UpdateService({ scheduleData, id: scheduleId, companyId });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit("schedule", {
    action: "update",
    schedule
  });

  return res.status(200).json(schedule);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { scheduleId } = req.params;
  const { companyId } = req.user;

  await DeleteService(scheduleId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit("schedule", {
    action: "delete",
    scheduleId
  });

  return res.status(200).json({ message: "Schedule deleted" });
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);
  const { companyId } = req.user;

  try {
    const schedule = await Schedule.findOne({
      where: { id, companyId }
    });
    if (!schedule) {
      throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
    }
    if (!file) {
      throw new AppError("Nenhum arquivo enviado", 400);
    }
    schedule.mediaPath = file.filename;
    schedule.mediaName = file.originalname;

    await schedule.save();
    if (file.size > 0) {
      void incrementCompanyStorageUsage(companyId, file.size);
    }
    return res.send({ mensagem: "Arquivo Anexado" });
    } catch (err: any) {
      throw new AppError(err.message);
  }
};

export const deleteMedia = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;

  try {
    const schedule = await Schedule.findOne({
      where: { id, companyId }
    });
    if (!schedule) {
      throw new AppError("ERR_NO_SCHEDULE_FOUND", 404);
    }
    const filePath = path.resolve("public", schedule.mediaPath);
    const fileExists = fs.existsSync(filePath);
    if (fileExists) {
      const sz = tryStatFileBytes(filePath);
      void decrementCompanyStorageUsage(companyId, sz);
      fs.unlinkSync(filePath);
    }
    schedule.mediaPath = null;
    schedule.mediaName = null;
    await schedule.save();
    return res.send({ mensagem: "Arquivo Excluído" });
    } catch (err: any) {
      throw new AppError(err.message);
  }
};