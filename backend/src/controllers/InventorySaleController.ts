import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  INVENTORY_SALES_APPLY_DISCOUNT,
  INVENTORY_SALES_AUTHORIZE_DISCOUNT,
  INVENTORY_SALES_AUTHORIZE_STORE_CREDIT_OVERRIDE,
  INVENTORY_SALES_MANAGE_PAYMENTS,
  INVENTORY_SALES_USE_STORE_CREDIT
} from "../config/inventorySalesPermissions";
import UpdateInventorySaleGlobalDiscountService from "../services/InventoryService/UpdateInventorySaleGlobalDiscountService";
import { DiscountAuthorizationInput } from "../services/InventoryService/inventoryDiscountGovernance";
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
import SearchInventoryContactsService from "../services/InventoryService/SearchInventoryContactsService";
import {
  addInventorySalePayment,
  deletePendingInventorySalePayment,
  listInventorySalePayments,
  settleInventorySalePayment,
  updatePendingInventorySalePayment
} from "../services/InventoryService/InventorySalePaymentLinesService";
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

function parseOptionalPaymentMode(raw: unknown): "legacy" | "lines" | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const mode = String(raw).trim();
  if (mode === "legacy" || mode === "lines") return mode;
  throw new AppError(
    "ERR_VALIDATION_ERROR",
    400,
    "paymentMode inválido."
  );
}

async function resolveFeatureFlag(
  req: Request,
  key: string
): Promise<boolean> {
  if (await isPlatformSuperUser(req)) return true;
  const ctx = await loadCompanyPlanContext(req);
  if (!ctx) return false;
  const merged = await computeEffectiveUserFeatureMapForRequest(
    req,
    ctx.featureMap
  );
  return merged[key] === true;
}

async function resolveCanManagePayments(req: Request): Promise<boolean> {
  return resolveFeatureFlag(req, INVENTORY_SALES_MANAGE_PAYMENTS);
}

async function resolveDiscountAuthorization(
  req: Request
): Promise<DiscountAuthorizationInput | undefined> {
  const raw = req.body?.discountAuthorization;
  if (!raw || typeof raw !== "object") return undefined;
  const canAuthorizeDiscount = await resolveFeatureFlag(
    req,
    INVENTORY_SALES_AUTHORIZE_DISCOUNT
  );
  return {
    authorize:
      raw.authorize === true ||
      raw.authorize === "true" ||
      raw.authorizeOverride === true,
    authorizedByUserId: userIdOrNull(req),
    reason: raw.reason,
    canAuthorizeDiscount
  };
}

function mergeDiscountAuthIntoBody(
  body: Record<string, unknown>,
  auth: DiscountAuthorizationInput | undefined
): Record<string, unknown> {
  if (!auth) return body;
  return { ...body, discountAuthorization: auth };
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

export const searchContacts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const contacts = await SearchInventoryContactsService({
    companyId,
    search: req.query.search,
    limit: req.query.limit
  });
  return res.json({ contacts });
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
    customerId: req.query.customerId,
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
  const canApplyDiscount = await resolveFeatureFlag(
    req,
    INVENTORY_SALES_APPLY_DISCOUNT
  );
  const discountAuthorization = await resolveDiscountAuthorization(req);
  const item = await AddInventorySaleItemService({
    companyId,
    saleId: parseIdParam(req.params.id),
    body: mergeDiscountAuthIntoBody(req.body || {}, discountAuthorization),
    canApplyDiscount
  });
  return res.status(201).json(item);
};

export const updateSaleItem = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const canApplyDiscount = await resolveFeatureFlag(
    req,
    INVENTORY_SALES_APPLY_DISCOUNT
  );
  const discountAuthorization = await resolveDiscountAuthorization(req);
  const item = await UpdateInventorySaleItemService({
    companyId,
    saleId: parseIdParam(req.params.id),
    itemId: parseIdParam(req.params.itemId),
    body: mergeDiscountAuthIntoBody(req.body || {}, discountAuthorization),
    canApplyDiscount
  });
  return res.json(item);
};

export const updateSaleGlobalDiscount = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const canApplyDiscount = await resolveFeatureFlag(
    req,
    INVENTORY_SALES_APPLY_DISCOUNT
  );
  const discountAuthorization = await resolveDiscountAuthorization(req);
  const sale = await UpdateInventorySaleGlobalDiscountService({
    companyId,
    saleId: parseIdParam(req.params.id),
    body: mergeDiscountAuthIntoBody(req.body || {}, discountAuthorization),
    canApplyDiscount
  });
  return res.json(sale);
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

  const canUseStoreCredit = await resolveFeatureFlag(
    req,
    INVENTORY_SALES_USE_STORE_CREDIT
  );
  const canAuthorizeOverride = await resolveFeatureFlag(
    req,
    INVENTORY_SALES_AUTHORIZE_STORE_CREDIT_OVERRIDE
  );
  const actorId = userIdOrNull(req);
  const overrideBody = req.body?.storeCreditOverride;
  const storeCreditOverride =
    overrideBody && typeof overrideBody === "object"
      ? {
          authorizeOverride:
            overrideBody.authorizeOverride === true ||
            overrideBody.authorizeOverride === "true",
          authorizedByUserId: actorId,
          reason: overrideBody.reason,
          canAuthorizeOverride
        }
      : undefined;

  const scheduleBody = req.body?.storeCreditSchedule;
  const storeCreditSchedule =
    scheduleBody && typeof scheduleBody === "object"
      ? {
          frequency: scheduleBody.frequency,
          installmentCount: scheduleBody.installmentCount,
          firstDueDate: scheduleBody.firstDueDate
        }
      : undefined;

  const discountAuthorization = await resolveDiscountAuthorization(req);

  const sale = await CompleteInventorySaleService({
    companyId,
    saleId: parseIdParam(req.params.id),
    sellerUserId: req.body?.sellerUserId,
    completedBy: actorId,
    registerAsPaid,
    canManagePayments,
    paymentMode: parseOptionalPaymentMode(req.body?.paymentMode),
    storeCreditSchedule,
    storeCreditOverride,
    canUseStoreCredit,
    discountAuthorization
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

export const listSalePayments = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const bundle = await listInventorySalePayments({
    companyId,
    saleId: parseIdParam(req.params.id)
  });
  return res.json(bundle);
};

export const createSalePayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const bundle = await addInventorySalePayment({
    companyId,
    saleId: parseIdParam(req.params.id),
    body: req.body || {},
    actorUserId: userIdOrNull(req)
  });
  return res.status(201).json(bundle);
};

export const updateSalePaymentLine = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const bundle = await updatePendingInventorySalePayment({
    companyId,
    saleId: parseIdParam(req.params.id),
    paymentId: parseIdParam(req.params.paymentId),
    body: req.body || {},
    actorUserId: userIdOrNull(req)
  });
  return res.json(bundle);
};

export const deleteSalePaymentLine = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const bundle = await deletePendingInventorySalePayment({
    companyId,
    saleId: parseIdParam(req.params.id),
    paymentId: parseIdParam(req.params.paymentId)
  });
  return res.json(bundle);
};

export const settleSalePaymentLine = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const bundle = await settleInventorySalePayment({
    companyId,
    saleId: parseIdParam(req.params.id),
    paymentId: parseIdParam(req.params.paymentId),
    body: req.body || {},
    actorUserId: userIdOrNull(req)
  });
  return res.json(bundle);
};
