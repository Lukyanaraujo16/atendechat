import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  listCompaniesBillingStatus,
  simulateBillingAutomation
} from "../services/SaasBilling/BillingSimulationService";
import { isValidDomainDate } from "../services/SaasBilling/billingEvaluation";

/** GET /saas/billing-automation/simulation?today=YYYY-MM-DD — somente leitura. */
export const simulation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const rawToday = req.query.today;
  let today: string | undefined;
  if (rawToday !== undefined && rawToday !== "") {
    if (!isValidDomainDate(rawToday)) {
      throw new AppError(
        "ERR_INVALID_DATE",
        400,
        "Data inválida. Use o formato AAAA-MM-DD."
      );
    }
    today = rawToday;
  }
  const result = await simulateBillingAutomation({ today });
  return res.status(200).json(result);
};

/** GET /saas/companies/billing-status[?companyIds=1,2,3] — status em lote, somente leitura. */
export const billingStatus = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const raw = req.query.companyIds;
  let companyIds: number[] | undefined;
  if (raw !== undefined && raw !== "") {
    const parts = String(raw)
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    const ids = parts.map(Number);
    if (ids.some(id => !Number.isInteger(id) || id <= 0) || ids.length > 1000) {
      throw new AppError(
        "ERR_INVALID_COMPANY",
        400,
        "Lista de empresas inválida."
      );
    }
    companyIds = Array.from(new Set(ids));
  }
  const result = await listCompaniesBillingStatus({ companyIds });
  return res.status(200).json(result);
};
