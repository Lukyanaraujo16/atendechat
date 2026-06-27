import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListInventorySellerProfilesService from "../services/InventoryService/ListInventorySellerProfilesService";
import CreateInventorySellerProfileService from "../services/InventoryService/CreateInventorySellerProfileService";
import UpdateInventorySellerProfileService from "../services/InventoryService/UpdateInventorySellerProfileService";
import DeleteInventorySellerProfileService from "../services/InventoryService/DeleteInventorySellerProfileService";

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

export const listSellerProfiles = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListInventorySellerProfilesService({
    companyId,
    active: req.query.active
  });
  return res.json(rows);
};

export const createSellerProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await CreateInventorySellerProfileService({
    companyId,
    body: req.body
  });
  return res.status(201).json(row);
};

export const updateSellerProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await UpdateInventorySellerProfileService({
    companyId,
    id: parseIdParam(req.params.id),
    body: req.body
  });
  return res.json(row);
};

export const deleteSellerProfile = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await DeleteInventorySellerProfileService({
    companyId,
    id: parseIdParam(req.params.id)
  });
  return res.json(row);
};
