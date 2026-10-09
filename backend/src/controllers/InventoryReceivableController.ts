import { Request, Response } from "express";
import AppError from "../errors/AppError";
import ListInventoryReceivablesService from "../services/InventoryService/ListInventoryReceivablesService";
import GetInventoryReceivableSummaryService from "../services/InventoryService/GetInventoryReceivableSummaryService";
import GetInventoryReceivableService from "../services/InventoryService/GetInventoryReceivableService";
import CreateInventoryReceivablePaymentService from "../services/InventoryService/CreateInventoryReceivablePaymentService";
import ReverseInventoryReceivablePaymentService from "../services/InventoryService/ReverseInventoryReceivablePaymentService";

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

export const listReceivables = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const result = await ListInventoryReceivablesService({
    companyId,
    search: req.query.search,
    status: req.query.status,
    customerId: req.query.customerId,
    dueFrom: req.query.dueFrom,
    dueTo: req.query.dueTo,
    bucket: req.query.bucket,
    page: req.query.page,
    limit: req.query.limit
  });
  return res.json(result);
};

export const getReceivableSummary = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const summary = await GetInventoryReceivableSummaryService({
    companyId,
    customerId: req.query.customerId
  });
  return res.json(summary);
};

export const getReceivable = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const receivable = await GetInventoryReceivableService({
    companyId,
    receivableId: parseIdParam(req.params.id)
  });
  return res.json(receivable);
};

export const createReceivablePayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const receivable = await CreateInventoryReceivablePaymentService({
    companyId,
    body: {
      receivableId: req.body?.receivableId ?? req.params.id,
      installmentIds: req.body?.installmentIds,
      amount: req.body?.amount,
      paymentMethod: req.body?.paymentMethod,
      paidAt: req.body?.paidAt,
      notes: req.body?.notes
    },
    createdByUserId: userIdOrNull(req)
  });
  return res.status(201).json(receivable);
};

export const reverseReceivablePayment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = companyIdOrThrow(req);
  const receivable = await ReverseInventoryReceivablePaymentService({
    companyId,
    paymentId: parseIdParam(req.params.paymentId),
    reversedByUserId: userIdOrNull(req),
    reason: req.body?.reason ?? req.body?.reverseReason
  });
  return res.json(receivable);
};
