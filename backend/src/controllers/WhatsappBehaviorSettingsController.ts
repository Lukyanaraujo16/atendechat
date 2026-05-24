import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { assertBehaviorSettingsPayload } from "../helpers/buildWhatsappBehaviorPatch";
import { getWhatsappBehaviorRow } from "../helpers/whatsappBehaviorSettings";
import BulkUpdateWhatsappBehaviorSettingsService, {
  listWhatsappBehaviorSettingsForCompany
} from "../services/WhatsappService/BulkUpdateWhatsappBehaviorSettingsService";
import UpdateWhatsappBehaviorSettingsService from "../services/WhatsappService/UpdateWhatsappBehaviorSettingsService";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const companyId = Number(req.user?.companyId);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const rows = await listWhatsappBehaviorSettingsForCompany(companyId);
  return res.status(200).json(rows);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const companyId = Number(req.user?.companyId);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const whatsappId = Number(req.params.whatsappId);
  if (!Number.isFinite(whatsappId) || whatsappId <= 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }
  const row = await getWhatsappBehaviorRow(companyId, whatsappId);
  if (!row) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  return res.status(200).json(row);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const companyId = Number(req.user?.companyId);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const whatsappId = Number(req.params.whatsappId);
  if (!Number.isFinite(whatsappId) || whatsappId <= 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }
  const { settings } = req.body as { settings?: Record<string, unknown> };
  if (!settings || typeof settings !== "object") {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }
  const row = await UpdateWhatsappBehaviorSettingsService({
    companyId,
    whatsappId,
    settings: assertBehaviorSettingsPayload(settings)
  });
  return res.status(200).json(row);
};

export const bulkUpdate = async (req: Request, res: Response): Promise<Response> => {
  const companyId = Number(req.user?.companyId);
  if (!Number.isFinite(companyId)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
  const { whatsappIds, settings } = req.body as {
    whatsappIds?: number[];
    settings?: Record<string, unknown>;
  };
  if (!Array.isArray(whatsappIds) || !settings || typeof settings !== "object") {
    throw new AppError("ERR_VALIDATION_ERROR", 400);
  }
  const result = await BulkUpdateWhatsappBehaviorSettingsService({
    companyId,
    whatsappIds,
    settings: assertBehaviorSettingsPayload(settings)
  });
  const rows = await listWhatsappBehaviorSettingsForCompany(companyId);
  return res.status(200).json({ ...result, connections: rows });
};
