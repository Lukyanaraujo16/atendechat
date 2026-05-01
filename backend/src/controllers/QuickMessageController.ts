import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListService from "../services/QuickMessageService/ListService";
import CreateService from "../services/QuickMessageService/CreateService";
import ShowService from "../services/QuickMessageService/ShowService";
import UpdateService from "../services/QuickMessageService/UpdateService";
import DeleteService from "../services/QuickMessageService/DeleteService";
import FindService from "../services/QuickMessageService/FindService";

import QuickMessage from "../models/QuickMessage";

import { head } from "lodash";
import fs from "fs";
import path from "path";

import AppError from "../errors/AppError";
import {
  incrementCompanyStorageUsage,
  decrementCompanyStorageUsage,
  tryStatFileBytes
} from "../services/CompanyService/adjustCompanyStorageUsage";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type StoreData = {
  shortcode: string;
  message: string;
  category?: string | null;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId, id: userId } = req.user;

  const { records, count, hasMore } = await ListService({
    searchParam,
    pageNumber,
    companyId,
    userId
  });

  return res.json({ records, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = req.body as StoreData;

  const schema = Yup.object().shape({
    shortcode: Yup.string().required(),
    message: Yup.string().required(),
    category: Yup.string().nullable()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await CreateService({
    ...data,
    companyId,
    userId: req.user.id
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-quickmessage`, {
    action: "create",
    record
  });

  return res.status(200).json(record);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId, id: userId } = req.user;

  const record = await ShowService(id, { companyId, userId });

  return res.status(200).json(record);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const data = req.body as Partial<StoreData> & { isMedia?: boolean };
  const { companyId, id: userId } = req.user;

  const schema = Yup.object().shape({
    shortcode: Yup.string().nullable(),
    message: Yup.string().nullable(),
    category: Yup.string().nullable()
  });

  try {
    await schema.validate(data);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;

  const record = await UpdateService({
    shortcode: data.shortcode,
    message: data.message,
    category: data.category,
    userId,
    companyId,
    id
  });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-quickmessage`, {
    action: "update",
    record
  });

  return res.status(200).json(record);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const { companyId, id: userId } = req.user;

  await DeleteService(id, { companyId, userId });

  const io = getIO();
  io.to(`company-${companyId}-mainchannel`).emit(`company-${companyId}-quickmessage`, {
    action: "delete",
    id
  });

  return res.status(200).json({ message: "Quick message deleted" });
};

export const findList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const records: QuickMessage[] = await FindService({
    companyId: String(companyId),
    userId: String(userId)
  });

  return res.status(200).json(records);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const files = req.files as Express.Multer.File[];
  const file = head(files);
  const { companyId, id: userId } = req.user;

  try {
    if (!file) {
      throw new AppError("Nenhum arquivo enviado.", 400);
    }

    const quickmessage = await QuickMessage.findOne({
      where: { id, companyId, userId }
    });

    if (!quickmessage) {
      throw new AppError("ERR_NO_QUICKMESSAGE_FOUND", 404);
    }

    await quickmessage.update({
      mediaPath: file.filename,
      mediaName: file.originalname
    });

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
  const { companyId, id: userId } = req.user;

  try {
    const quickmessage = await QuickMessage.findOne({
      where: { id, companyId, userId }
    });

    if (!quickmessage) {
      throw new AppError("ERR_NO_QUICKMESSAGE_FOUND", 404);
    }

    const storedFile = quickmessage.getDataValue("mediaPath");
    if (storedFile) {
      const filePath = path.resolve("public", "quickMessage", storedFile);
      const fileExists = fs.existsSync(filePath);
      if (fileExists) {
        const sz = tryStatFileBytes(filePath);
        void decrementCompanyStorageUsage(companyId, sz);
        fs.unlinkSync(filePath);
      }
    }

    await quickmessage.update({
      mediaPath: null,
      mediaName: null
    });

    return res.send({ mensagem: "Arquivo Excluído" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};
