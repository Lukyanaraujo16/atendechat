import { Request, Response } from "express";
import AppError from "../errors/AppError";
import GetOrCreateInventorySettingsService from "../services/InventoryService/GetOrCreateInventorySettingsService";
import UpdateInventorySettingsService from "../services/InventoryService/UpdateInventorySettingsService";
import ListInventoryCategoriesService from "../services/InventoryService/ListInventoryCategoriesService";
import CreateInventoryCategoryService from "../services/InventoryService/CreateInventoryCategoryService";
import UpdateInventoryCategoryService from "../services/InventoryService/UpdateInventoryCategoryService";
import DeleteInventoryCategoryService from "../services/InventoryService/DeleteInventoryCategoryService";
import ListInventoryProductsService from "../services/InventoryService/ListInventoryProductsService";
import ShowInventoryProductService from "../services/InventoryService/ShowInventoryProductService";
import CreateInventoryProductService from "../services/InventoryService/CreateInventoryProductService";
import UpdateInventoryProductService from "../services/InventoryService/UpdateInventoryProductService";
import DeleteInventoryProductService from "../services/InventoryService/DeleteInventoryProductService";
import CreateInventoryStockMovementService from "../services/InventoryService/CreateInventoryStockMovementService";
import ListInventoryStockMovementsService from "../services/InventoryService/ListInventoryStockMovementsService";
import ListInventoryProductStockMovementsService from "../services/InventoryService/ListInventoryProductStockMovementsService";
import ListInventoryLowStockProductsService from "../services/InventoryService/ListInventoryLowStockProductsService";

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

export const getSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const settings = await GetOrCreateInventorySettingsService(companyId);
  return res.json(settings);
};

export const updateSettings = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const settings = await UpdateInventorySettingsService({
    companyId,
    body: req.body
  });
  return res.json(settings);
};

export const listCategories = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListInventoryCategoriesService({
    companyId,
    active: req.query.active
  });
  return res.json(rows);
};

export const createCategory = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await CreateInventoryCategoryService({
    companyId,
    body: req.body
  });
  return res.status(201).json(row);
};

export const updateCategory = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const row = await UpdateInventoryCategoryService({
    companyId,
    id,
    body: req.body
  });
  return res.json(row);
};

export const deleteCategory = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const row = await DeleteInventoryCategoryService({ companyId, id });
  return res.json(row);
};

export const listProducts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListInventoryProductsService({
    companyId,
    search: req.query.search,
    categoryId: req.query.categoryId,
    active: req.query.active,
    lowStock: req.query.lowStock
  });
  return res.json(rows);
};

export const showProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const row = await ShowInventoryProductService({ companyId, id });
  return res.json(row);
};

export const createProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await CreateInventoryProductService({
    companyId,
    body: req.body
  });
  return res.status(201).json(row);
};

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const row = await UpdateInventoryProductService({
    companyId,
    id,
    body: req.body
  });
  return res.json(row);
};

export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const id = parseIdParam(req.params.id);
  const row = await DeleteInventoryProductService({ companyId, id });
  return res.json(row);
};

export const createStockMovement = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await CreateInventoryStockMovementService({
    companyId,
    createdBy:
      req.user?.id != null && Number.isFinite(Number(req.user.id))
        ? Number(req.user.id)
        : null,
    body: req.body
  });
  return res.status(201).json(row);
};

export const listStockMovements = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListInventoryStockMovementsService({
    companyId,
    productId: req.query.productId,
    type: req.query.type,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    page: req.query.page,
    limit: req.query.limit
  });
  return res.json(result);
};

export const listProductStockMovements = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const productId = parseIdParam(req.params.id);
  const result = await ListInventoryProductStockMovementsService({
    companyId,
    productId,
    type: req.query.type,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    page: req.query.page,
    limit: req.query.limit
  });
  return res.json(result);
};

export const listLowStockProducts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListInventoryLowStockProductsService(companyId);
  return res.json(rows);
};
