import { Request, Response } from "express";
import AppError from "../errors/AppError";
import CreateInventorySaleService from "../services/InventoryService/CreateInventorySaleService";
import ListInventorySalesService from "../services/InventoryService/ListInventorySalesService";
import ShowInventorySaleService from "../services/InventoryService/ShowInventorySaleService";
import UpdateInventorySaleService from "../services/InventoryService/UpdateInventorySaleService";
import DeleteInventorySaleService from "../services/InventoryService/DeleteInventorySaleService";
import AddInventorySaleItemService from "../services/InventoryService/AddInventorySaleItemService";
import UpdateInventorySaleItemService from "../services/InventoryService/UpdateInventorySaleItemService";
import DeleteInventorySaleItemService from "../services/InventoryService/DeleteInventorySaleItemService";
import CompleteInventorySaleService from "../services/InventoryService/CompleteInventorySaleService";
import CancelInventorySaleService from "../services/InventoryService/CancelInventorySaleService";

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

function userIdOrNull(req: Request): number | null {
  return req.user?.id != null && Number.isFinite(Number(req.user.id))
    ? Number(req.user.id)
    : null;
}

export const listSales = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListInventorySalesService({
    companyId,
    status: req.query.status,
    contactId: req.query.contactId,
    ticketId: req.query.ticketId,
    sellerUserId: req.query.sellerUserId,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  });
  return res.json(result);
};

export const createSale = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sale = await CreateInventorySaleService({
    companyId,
    createdBy: userIdOrNull(req),
    body: req.body
  });
  return res.status(201).json(sale);
};

export const showSale = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sale = await ShowInventorySaleService({
    companyId,
    id: parseIdParam(req.params.id)
  });
  return res.json(sale);
};

export const updateSale = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sale = await UpdateInventorySaleService({
    companyId,
    id: parseIdParam(req.params.id),
    body: req.body
  });
  return res.json(sale);
};

export const deleteSale = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  await DeleteInventorySaleService({
    companyId,
    id: parseIdParam(req.params.id)
  });
  return res.status(204).send();
};

export const addSaleItem = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const item = await AddInventorySaleItemService({
    companyId,
    saleId: parseIdParam(req.params.id),
    body: req.body
  });
  return res.status(201).json(item);
};

export const updateSaleItem = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const item = await UpdateInventorySaleItemService({
    companyId,
    saleId: parseIdParam(req.params.id),
    itemId: parseIdParam(req.params.itemId),
    body: req.body
  });
  return res.json(item);
};

export const deleteSaleItem = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  await DeleteInventorySaleItemService({
    companyId,
    saleId: parseIdParam(req.params.id),
    itemId: parseIdParam(req.params.itemId)
  });
  return res.status(204).send();
};

export const completeSale = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sale = await CompleteInventorySaleService({
    companyId,
    saleId: parseIdParam(req.params.id),
    sellerUserId: req.body?.sellerUserId,
    completedBy: userIdOrNull(req)
  });
  return res.json(sale);
};

export const cancelSale = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sale = await CancelInventorySaleService({
    companyId,
    saleId: parseIdParam(req.params.id),
    cancelledBy: userIdOrNull(req),
    cancelReason: req.body?.cancelReason
  });
  return res.json(sale);
};
