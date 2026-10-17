/**
 * Fase 8.4-F — Central de assinatura, linha do tempo e prévia da baixa manual (C3, C4, C6).
 * Rotas somente Super Admin (isAuth + isSuper em saasSubscriptionRoutes). Nenhuma escrita.
 */
import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getSubscriptionCenter } from "../services/SaasBilling/SubscriptionCenterService";
import { getCompanyTimeline } from "../services/SaasBilling/CompanyTimelineService";
import { previewManualPayment } from "../services/SaasBilling/registerManualPayment";

/** companyId do path — sempre usado no where (isolamento entre empresas). */
function parseCompanyId(req: Request): number {
  const companyId = Number(req.params.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new AppError("ERR_INVALID_COMPANY", 400);
  }
  return companyId;
}

export const subscription = async (req: Request, res: Response): Promise<Response> => {
  const companyId = parseCompanyId(req);
  return res.json(await getSubscriptionCenter(companyId));
};

export const timeline = async (req: Request, res: Response): Promise<Response> => {
  const companyId = parseCompanyId(req);
  const page = await getCompanyTimeline(companyId, {
    before: req.query.before,
    limit: req.query.limit
  });
  return res.json(page);
};

export const manualPaymentPreview = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = parseCompanyId(req);
  const body = req.body || {};
  const invoiceId = Number(body.invoiceId);
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    throw new AppError("ERR_VALIDATION", 400, "Informe a fatura (invoiceId).");
  }
  const preview = await previewManualPayment({
    companyId,
    invoiceId,
    kind: body.kind,
    amount: body.amount,
    method: body.method,
    paidAt: body.paidAt,
    reason: body.reason,
    renewSubscription: body.renewSubscription,
    expectedCurrentDueDate: body.expectedCurrentDueDate
  });
  return res.status(200).json(preview);
};
