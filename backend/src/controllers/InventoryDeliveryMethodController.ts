import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListInventoryDeliveryMethodsService from "../services/InventoryService/ListInventoryDeliveryMethodsService";
import CreateInventoryDeliveryMethodService from "../services/InventoryService/CreateInventoryDeliveryMethodService";
import UpdateInventoryDeliveryMethodService from "../services/InventoryService/UpdateInventoryDeliveryMethodService";
import DeactivateInventoryDeliveryMethodService from "../services/InventoryService/DeactivateInventoryDeliveryMethodService";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null) throw new AppError("ERR_NO_PERMISSION", 403);
  return id;
}

function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "ID inválido.");
  }
  return id;
}

export const listDeliveryMethods = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListInventoryDeliveryMethodsService({
    companyId,
    active: req.query.active,
    ensureDefaultPickup: true
  });
  return res.json(rows);
};

export const createDeliveryMethod = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await CreateInventoryDeliveryMethodService({
    companyId,
    body: req.body
  });
  return res.status(201).json(row);
};

export const updateDeliveryMethod = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await UpdateInventoryDeliveryMethodService({
    companyId,
    id: parseIdParam(req.params.id),
    body: req.body
  });
  return res.json(row);
};

export const deactivateDeliveryMethod = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await DeactivateInventoryDeliveryMethodService({
    companyId,
    id: parseIdParam(req.params.id)
  });
  return res.json(row);
};
