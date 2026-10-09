import { Request, Response } from "express";
import AppError from "../errors/AppError";
import GetOrCreateInventorySettingsService from "../services/InventoryService/GetOrCreateInventorySettingsService";
import GetInventoryReceiptBrandingService from "../services/InventoryService/GetInventoryReceiptBrandingService";
import UpdateInventorySettingsService from "../services/InventoryService/UpdateInventorySettingsService";
import {
  removeInventoryReceiptLogo,
  uploadInventoryReceiptLogo
} from "../services/InventoryService/inventoryReceiptLogo";
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
import ListInventoryProductAttributesService from "../services/InventoryService/ListInventoryProductAttributesService";
import CreateInventoryProductAttributeService from "../services/InventoryService/CreateInventoryProductAttributeService";
import CreateInventoryProductAttributeOptionService from "../services/InventoryService/CreateInventoryProductAttributeOptionService";
import ListInventoryProductVariantsService from "../services/InventoryService/ListInventoryProductVariantsService";
import CreateInventoryProductVariantService from "../services/InventoryService/CreateInventoryProductVariantService";
import UpdateInventoryProductVariantService from "../services/InventoryService/UpdateInventoryProductVariantService";
import SaveInventoryVariableProductService from "../services/InventoryService/SaveInventoryVariableProductService";
import { parseBooleanQuery } from "../services/InventoryService/inventoryTenant";

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

export const getReceiptBranding = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const branding = await GetInventoryReceiptBrandingService(companyId);
  return res.json(branding);
};

export const uploadReceiptLogo = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const { file } = req;
  if (!file || !file.buffer) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Selecione uma imagem.");
  }
  const result = await uploadInventoryReceiptLogo({
    companyId,
    buffer: file.buffer,
    mimetype: file.mimetype,
    originalName: file.originalname
  });
  return res.json(result);
};

export const deleteReceiptLogo = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await removeInventoryReceiptLogo(companyId);
  return res.json(result);
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
    lowStock: req.query.lowStock,
    limit: req.query.limit
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

export const saveVariableProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const productIdRaw = req.params.id;
  const productId =
    productIdRaw != null && productIdRaw !== ""
      ? parseIdParam(productIdRaw)
      : null;
  const result = await SaveInventoryVariableProductService({
    companyId,
    productId,
    body: req.body || {},
    createdBy:
      req.user?.id != null && Number.isFinite(Number(req.user.id))
        ? Number(req.user.id)
        : null
  });
  return res.status(productId == null ? 201 : 200).json(result);
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
  await DeleteInventoryProductService({ companyId, id });
  return res.status(204).send();
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

export const listProductAttributes = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const rows = await ListInventoryProductAttributesService({
    companyId,
    activeOnly: parseBooleanQuery(req.query.activeOnly) === true
  });
  return res.json(rows);
};

export const createProductAttribute = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const row = await CreateInventoryProductAttributeService({
    companyId,
    body: req.body
  });
  return res.status(201).json(row);
};

export const createProductAttributeOption = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const attributeId = parseIdParam(req.params.attributeId);
  const row = await CreateInventoryProductAttributeOptionService({
    companyId,
    attributeId,
    body: req.body
  });
  return res.status(201).json(row);
};

export const listProductVariants = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const productId = parseIdParam(req.params.id);
  const active = parseBooleanQuery(req.query.active);
  const rows = await ListInventoryProductVariantsService({
    companyId,
    productId,
    active: active === undefined ? null : active
  });
  return res.json(rows);
};

export const createProductVariant = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const productId = parseIdParam(req.params.id);
  const row = await CreateInventoryProductVariantService({
    companyId,
    productId,
    body: req.body,
    createdBy:
      req.user?.id != null && Number.isFinite(Number(req.user.id))
        ? Number(req.user.id)
        : null
  });
  return res.status(201).json(row);
};

export const updateProductVariant = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const productId = parseIdParam(req.params.id);
  const variantId = parseIdParam(req.params.variantId);
  const row = await UpdateInventoryProductVariantService({
    companyId,
    productId,
    variantId,
    body: req.body
  });
  return res.json(row);
};
