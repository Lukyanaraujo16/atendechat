import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT,
  INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS
} from "../config/inventorySalesPermissions";
import { loadCompanyPlanContext } from "../middleware/loadCompanyEffectiveFeatures";
import { isPlatformSuperUser } from "../middleware/platformSuperBypass";
import { computeEffectiveUserFeatureMapForRequest } from "../services/UserFeaturePermission/UserFeaturePermissionService";
import CreateInventoryCustomerService from "../services/InventoryService/CreateInventoryCustomerService";
import UpdateInventoryCustomerService from "../services/InventoryService/UpdateInventoryCustomerService";
import GetInventoryCustomerService from "../services/InventoryService/GetInventoryCustomerService";
import ListInventoryCustomersService from "../services/InventoryService/ListInventoryCustomersService";
import GetInventoryCustomerCreditSummaryService from "../services/InventoryService/GetInventoryCustomerCreditSummaryService";
import GetInventoryCustomerAccountService from "../services/InventoryService/GetInventoryCustomerAccountService";
import ActivateInventoryCustomerService from "../services/InventoryService/ActivateInventoryCustomerService";
import DeactivateInventoryCustomerService from "../services/InventoryService/DeactivateInventoryCustomerService";
import CreateInventoryCustomerFromContactService from "../services/InventoryService/CreateInventoryCustomerFromContactService";
import PreviewInventoryStoreCreditScheduleService from "../services/InventoryService/PreviewInventoryStoreCreditScheduleService";

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

async function canManageCredit(req: Request): Promise<boolean> {
  return resolveFeatureFlag(req, INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT);
}

async function canViewFinancials(req: Request): Promise<boolean> {
  if (await isPlatformSuperUser(req)) return true;
  const ctx = await loadCompanyPlanContext(req);
  if (!ctx) return false;
  const merged = await computeEffectiveUserFeatureMapForRequest(
    req,
    ctx.featureMap
  );
  return (
    merged[INVENTORY_SALES_VIEW_CUSTOMER_FINANCIALS] === true ||
    merged[INVENTORY_SALES_MANAGE_CUSTOMER_CREDIT] === true
  );
}

export const listCustomers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const includeFinancials = await canViewFinancials(req);
  const result = await ListInventoryCustomersService({
    companyId,
    search: req.query.search,
    isActive: req.query.isActive,
    withOpenBalance: includeFinancials ? req.query.withOpenBalance : undefined,
    withOverdue: includeFinancials ? req.query.withOverdue : undefined,
    page: req.query.page,
    limit: req.query.limit,
    includeFinancials
  });
  return res.json(result);
};

export const createCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const customer = await CreateInventoryCustomerService({
    companyId,
    body: req.body,
    canManageCredit: await canManageCredit(req)
  });
  return res.status(201).json(customer);
};

export const createCustomerFromContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const customer = await CreateInventoryCustomerFromContactService({
    companyId,
    contactId: parseIdParam(req.params.contactId),
    body: req.body,
    canManageCredit: await canManageCredit(req)
  });
  return res.status(201).json(customer);
};

export const getCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const includeFinancials = await canViewFinancials(req);
  const customer = await GetInventoryCustomerService({
    companyId,
    customerId: parseIdParam(req.params.id),
    includeFinancials
  });
  return res.json(customer);
};

export const updateCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const customer = await UpdateInventoryCustomerService({
    companyId,
    customerId: parseIdParam(req.params.id),
    body: req.body,
    canManageCredit: await canManageCredit(req)
  });
  return res.json(customer);
};

export const activateCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const customer = await ActivateInventoryCustomerService({
    companyId,
    customerId: parseIdParam(req.params.id)
  });
  return res.json(customer);
};

export const deactivateCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const customer = await DeactivateInventoryCustomerService({
    companyId,
    customerId: parseIdParam(req.params.id)
  });
  return res.json(customer);
};

export const getCustomerCredit = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const credit = await GetInventoryCustomerCreditSummaryService({
    companyId,
    customerId: parseIdParam(req.params.id)
  });
  return res.json(credit);
};

export const getCustomerAccount = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  if (!(await canViewFinancials(req))) {
    throw new AppError(
      "ERR_NO_PERMISSION",
      403,
      "Sem permissão para ver dados financeiros do Cliente."
    );
  }
  const account = await GetInventoryCustomerAccountService({
    companyId,
    customerId: parseIdParam(req.params.id)
  });
  return res.json(account);
};

export const previewStoreCreditSchedule = async (
  req: Request,
  res: Response
): Promise<Response> => {
  companyIdOrThrow(req);
  const preview = PreviewInventoryStoreCreditScheduleService({
    financedAmount: req.body?.financedAmount ?? req.query.financedAmount,
    frequency: req.body?.frequency ?? req.query.frequency,
    installmentCount:
      req.body?.installmentCount ?? req.query.installmentCount,
    firstDueDate: req.body?.firstDueDate ?? req.query.firstDueDate
  });
  return res.json(preview);
};
