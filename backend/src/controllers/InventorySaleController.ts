import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { INVENTORY_SALES_MANAGE_PAYMENTS } from "../config/inventorySalesPermissions";
import { loadCompanyPlanContext } from "../middleware/loadCompanyEffectiveFeatures";
import { isPlatformSuperUser } from "../middleware/platformSuperBypass";
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
import UpdateInventorySalePaymentService from "../services/InventoryService/UpdateInventorySalePaymentService";
import UpdateInventorySaleDeliveryService from "../services/InventoryService/UpdateInventorySaleDeliveryService";
import SearchInventoryCustomersService from "../services/InventoryService/SearchInventoryCustomersService";
import { computeEffectiveUserFeatureMapForRequest } from "../services/UserFeaturePermission/UserFeaturePermissionService";

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

function parseOptionalRegisterAsPaid(raw: unknown): boolean | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (raw === true || raw === "true" || raw === 1 || raw === "1") return true;
  if (raw === false || raw === "false" || raw === 0 || raw === "0") return false;
  throw new AppError(
    "ERR_VALIDATION_ERROR",
    400,
    "registerAsPaid inválido."
  );
}

async function resolveCanManagePayments(req: Request): Promise<boolean> {
  if (await isPlatformSuperUser(req)) return true;
  const ctx = await loadCompanyPlanContext(req);
  if (!ctx) return false;
  const merged = await computeEffectiveUserFeatureMapForRequest(
    req,
    ctx.featureMap
  );
  return merged[INVENTORY_SALES_MANAGE_PAYMENTS] === true;
}

export const searchCustomers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const customers = await SearchInventoryCustomersService({
    companyId,
    search: req.query.search,
    limit: req.query.limit
  });
  return res.json({ customers });
};

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
    paymentStatus: req.query.paymentStatus,
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
  const canManagePayments = await resolveCanManagePayments(req);
  const requestedRegisterAsPaid = parseOptionalRegisterAsPaid(
    req.body?.registerAsPaid
  );
  // Sem managePayments a flag é ignorada (não forja liquidação).
  const registerAsPaid = canManagePayments
    ? requestedRegisterAsPaid
    : undefined;

  const sale = await CompleteInventorySaleService({
    companyId,
    saleId: parseIdParam(req.params.id),
    sellerUserId: req.body?.sellerUserId,
    completedBy: userIdOrNull(req),
    registerAsPaid,
    canManagePayments
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

export const updateSalePayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sale = await UpdateInventorySalePaymentService({
    companyId,
    saleId: parseIdParam(req.params.id),
    body: req.body,
    actorUserId: userIdOrNull(req)
  });
  return res.json(sale);
};

export const updateSaleDelivery = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const sale = await UpdateInventorySaleDeliveryService({
    companyId,
    saleId: parseIdParam(req.params.id),
    body: req.body
  });
  return res.json(sale);
};
