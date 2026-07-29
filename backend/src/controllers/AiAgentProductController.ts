import { Request, Response } from "express";
import AppError from "../errors/AppError";
import GetAiAgentProductSummaryService, {
  GetAiAgentProductReadinessService
} from "../services/AiAgentProductService/GetAiAgentProductSummaryService";
import { logger } from "../utils/logger";

function companyIdOrThrow(req: Request): number {
  const id = req.user?.companyId;
  if (id == null || !Number.isFinite(Number(id))) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      403,
      "Contexto da empresa inválido."
    );
  }
  // companyId em query/body nunca substitui a sessão
  return Number(id);
}

function rejectArbitraryCompanyId(req: Request): void {
  if (req.query?.companyId != null || req.body?.companyId != null) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      403,
      "Contexto da empresa inválido."
    );
  }
}

export const summary = async (req: Request, res: Response): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await GetAiAgentProductSummaryService({ companyId, req });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      { err: err instanceof Error ? err.message : "unknown", surface: "ai_agent_product" },
      "ai_agent_product_summary_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível carregar o resumo do Agente de IA."
    );
  }
};

export const readiness = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await GetAiAgentProductReadinessService({ companyId, req });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      { err: err instanceof Error ? err.message : "unknown", surface: "ai_agent_product" },
      "ai_agent_product_readiness_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível carregar o readiness do Agente de IA."
    );
  }
};
