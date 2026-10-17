import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  applyHistoricalReview,
  getHistoricalReviewSummary,
  listHistoricalReviewQueue,
  previewHistoricalReview
} from "../services/SaasBilling/HistoricalReviewService";

/** Fase 8.4-F (C5) — regularização histórica. Rotas: isAuth + isSuper. */

function positiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** companyId do path — sempre no where (isolamento entre empresas). */
function parsePathIds(req: Request): { companyId: number; invoiceId: number } {
  const companyId = positiveInt(req.params.companyId);
  if (!companyId) throw new AppError("ERR_INVALID_COMPANY", 400);
  const invoiceId = positiveInt(req.params.invoiceId);
  if (!invoiceId) throw new AppError("ERR_INVOICE_NOT_FOUND", 404, "Fatura não encontrada.");
  return { companyId, invoiceId };
}

function pickInput(body: any) {
  const b = body && typeof body === "object" ? body : {};
  return {
    decision: b.decision,
    note: b.note,
    confirmationSource: b.confirmationSource,
    paidAt: b.paidAt,
    paidAtUnknown: b.paidAtUnknown,
    amount: b.amount,
    method: b.method,
    efiChargeAcknowledged: b.efiChargeAcknowledged
  };
}

export const list = async (req: Request, res: Response): Promise<Response> => {
  const q = req.query as Record<string, string>;
  let companyId: number | undefined;
  if (q.companyId !== undefined && q.companyId !== "") {
    const id = positiveInt(q.companyId);
    if (!id) throw new AppError("ERR_INVALID_COMPANY", 400);
    companyId = id;
  }
  const data = await listHistoricalReviewQueue({
    companyId,
    state: q.state,
    page: q.page ? Number(q.page) : 1,
    limit: q.limit ? Number(q.limit) : 20
  });
  return res.json(data);
};

export const summary = async (req: Request, res: Response): Promise<Response> => {
  const q = req.query as Record<string, string>;
  const companyId = q.companyId ? positiveInt(q.companyId) || undefined : undefined;
  const data = await getHistoricalReviewSummary(companyId);
  return res.json(data);
};

export const preview = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, invoiceId } = parsePathIds(req);
  const data = await previewHistoricalReview({
    companyId,
    invoiceId,
    input: pickInput(req.body)
  });
  return res.json(data);
};

export const apply = async (req: Request, res: Response): Promise<Response> => {
  const { companyId, invoiceId } = parsePathIds(req);
  const result = await applyHistoricalReview({
    companyId,
    invoiceId,
    actorUserId: Number(req.user.id),
    input: pickInput(req.body)
  });
  return res.status(201).json(result);
};
