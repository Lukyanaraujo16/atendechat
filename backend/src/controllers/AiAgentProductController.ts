import { Request, Response } from "express";
import AppError from "../errors/AppError";
import GetAiAgentProductSummaryService, {
  GetAiAgentProductReadinessService
} from "../services/AiAgentProductService/GetAiAgentProductSummaryService";
import ExecuteAiAgentProductCommandService from "../services/AiAgentProductService/ExecuteAiAgentProductCommandService";
import GetAiAgentProductConfigurationService from "../services/AiAgentProductService/GetAiAgentProductConfigurationService";
import GetAiAgentProductConfigurationOptionsService from "../services/AiAgentProductService/GetAiAgentProductConfigurationOptionsService";
import CreateAiAgentProductConfigurationService from "../services/AiAgentProductService/CreateAiAgentProductConfigurationService";
import UpdateAiAgentProductConfigurationService from "../services/AiAgentProductService/UpdateAiAgentProductConfigurationService";
import UpdateAiAgentProductConnectionsService from "../services/AiAgentProductService/UpdateAiAgentProductConnectionsService";
import PreviewAiAgentProductConfigurationService from "../services/AiAgentProductService/PreviewAiAgentProductConfigurationService";
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

export const command = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await ExecuteAiAgentProductCommandService({
      companyId,
      req,
      body: req.body as Record<string, unknown>
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_command_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_COMMAND_NOT_ALLOWED",
      500,
      "Não foi possível executar o comando do Agente de IA."
    );
  }
};

export const getConfiguration = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await GetAiAgentProductConfigurationService({
      companyId,
      req
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_configuration_get_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível carregar a configuração do Agente de IA."
    );
  }
};

export const createConfiguration = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await CreateAiAgentProductConfigurationService({
      companyId,
      req,
      body: req.body as Record<string, unknown>
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_configuration_create_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      500,
      "Não foi possível criar a configuração do Agente de IA."
    );
  }
};

export const updateConfiguration = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await UpdateAiAgentProductConfigurationService({
      companyId,
      req,
      body: req.body as Record<string, unknown>
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_configuration_update_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      500,
      "Não foi possível atualizar a configuração do Agente de IA."
    );
  }
};

export const getConfigurationOptions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await GetAiAgentProductConfigurationOptionsService({
      companyId,
      req
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_configuration_options_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível carregar as opções de configuração do Agente de IA."
    );
  }
};

export const previewConfiguration = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await PreviewAiAgentProductConfigurationService({
      companyId,
      req,
      body: req.body as Record<string, unknown>
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_configuration_preview_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      500,
      "Não foi possível gerar a prévia da configuração do Agente de IA."
    );
  }
};

export const updateConnections = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await UpdateAiAgentProductConnectionsService({
      companyId,
      req,
      body: req.body as Record<string, unknown>
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_connections_update_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      500,
      "Não foi possível atualizar as conexões do Agente de IA."
    );
  }
};
