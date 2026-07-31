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
import GetAiAgentProductSimulatorService from "../services/AiAgentProductService/GetAiAgentProductSimulatorService";
import CreateAiAgentProductSimulatorSessionService from "../services/AiAgentProductService/CreateAiAgentProductSimulatorSessionService";
import ListAiAgentProductSimulatorSessionsService from "../services/AiAgentProductService/ListAiAgentProductSimulatorSessionsService";
import GetAiAgentProductSimulatorSessionService from "../services/AiAgentProductService/GetAiAgentProductSimulatorSessionService";
import SendAiAgentProductSimulatorMessageService from "../services/AiAgentProductService/SendAiAgentProductSimulatorMessageService";
import EndAiAgentProductSimulatorSessionService from "../services/AiAgentProductService/EndAiAgentProductSimulatorSessionService";
import ReviewAiAgentProductSimulatorMessageService from "../services/AiAgentProductService/ReviewAiAgentProductSimulatorMessageService";
import { rejectProductSimulatorForbiddenIds } from "../services/AiAgentProductService/aiAgentProductSimulatorHelpers";
import ListAiAgentProductCredentialsService from "../services/AiAgentProductService/ListAiAgentProductCredentialsService";
import GetAiAgentProductCredentialService from "../services/AiAgentProductService/GetAiAgentProductCredentialService";
import CreateAiAgentProductCredentialService from "../services/AiAgentProductService/CreateAiAgentProductCredentialService";
import UpdateAiAgentProductCredentialService from "../services/AiAgentProductService/UpdateAiAgentProductCredentialService";
import TestAiAgentProductCredentialService from "../services/AiAgentProductService/TestAiAgentProductCredentialService";
import EnableAiAgentProductCredentialService from "../services/AiAgentProductService/EnableAiAgentProductCredentialService";
import DisableAiAgentProductCredentialService from "../services/AiAgentProductService/DisableAiAgentProductCredentialService";
import ListAiAgentProductAgentsService from "../services/AiAgentProductService/ListAiAgentProductAgentsService";
import ListAiAgentProductKnowledgeService from "../services/AiAgentProductService/ListAiAgentProductKnowledgeService";
import SyncAiAgentProductKnowledgeService from "../services/AiAgentProductService/SyncAiAgentProductKnowledgeService";
import { extractAgentRefFromRequest } from "../services/AiAgentProductService/aiAgentProductAgentRef";
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

function userIdOrThrow(req: Request): number {
  const id = req.user?.id;
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

export const listAgents = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await ListAiAgentProductAgentsService({ companyId, req });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_agents_list_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível listar os Agentes de IA."
    );
  }
};

export const summary = async (req: Request, res: Response): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>
    });
    const data = await GetAiAgentProductSummaryService({
      companyId,
      req,
      agentRef
    });
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
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>
    });
    const data = await GetAiAgentProductReadinessService({
      companyId,
      req,
      agentRef
    });
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
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>
    });
    const data = await ExecuteAiAgentProductCommandService({
      companyId,
      req,
      body: req.body as Record<string, unknown>,
      agentRef
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
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>
    });
    const data = await GetAiAgentProductConfigurationService({
      companyId,
      req,
      agentRef
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
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>
    });
    const data = await UpdateAiAgentProductConfigurationService({
      companyId,
      req,
      body: req.body as Record<string, unknown>,
      agentRef
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
      req,
      agentRef: extractAgentRefFromRequest({
        params: req.params as Record<string, unknown>,
        query: req.query as Record<string, unknown>
      })
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
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>
    });
    const data = await UpdateAiAgentProductConnectionsService({
      companyId,
      req,
      body: req.body as Record<string, unknown>,
      agentRef
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

export const simulatorBootstrap = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    rejectProductSimulatorForbiddenIds(req);
    const companyId = companyIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>
    });
    const data = await GetAiAgentProductSimulatorService({
      companyId,
      req,
      agentRef
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_simulator"
      },
      "ai_agent_product_simulator_bootstrap_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível carregar o simulador do Agente de IA."
    );
  }
};

export const simulatorCreateSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    rejectProductSimulatorForbiddenIds(req);
    const companyId = companyIdOrThrow(req);
    const userId = userIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>
    });
    const data = await CreateAiAgentProductSimulatorSessionService({
      companyId,
      userId,
      req,
      agentRef
    });
    return res.status(201).json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_simulator"
      },
      "ai_agent_product_simulator_create_session_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_UNAVAILABLE",
      500,
      "Não foi possível iniciar a sessão do simulador."
    );
  }
};

export const simulatorListSessions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    rejectProductSimulatorForbiddenIds(req);
    const companyId = companyIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>
    });
    const data = await ListAiAgentProductSimulatorSessionsService({
      companyId,
      req,
      agentRef,
      pageNumber: req.query.pageNumber as string | undefined
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_simulator"
      },
      "ai_agent_product_simulator_list_sessions_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível listar as sessões do simulador."
    );
  }
};

export const simulatorGetSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    rejectProductSimulatorForbiddenIds(req);
    const companyId = companyIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>
    });
    const data = await GetAiAgentProductSimulatorSessionService({
      companyId,
      sessionRef: String(req.params.sessionRef || ""),
      req,
      agentRef
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_simulator"
      },
      "ai_agent_product_simulator_get_session_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_NOT_FOUND",
      500,
      "Não foi possível carregar a sessão do simulador."
    );
  }
};

export const simulatorSendMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    rejectProductSimulatorForbiddenIds(req);
    const companyId = companyIdOrThrow(req);
    const userId = userIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>
    });
    const data = await SendAiAgentProductSimulatorMessageService({
      companyId,
      sessionRef: String(req.params.sessionRef || ""),
      content: (req.body as Record<string, unknown>)?.content,
      userId,
      req,
      agentRef
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_simulator"
      },
      "ai_agent_product_simulator_send_message_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_INVALID",
      500,
      "Não foi possível enviar a mensagem no simulador."
    );
  }
};

export const simulatorEndSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    rejectProductSimulatorForbiddenIds(req);
    const companyId = companyIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>
    });
    const data = await EndAiAgentProductSimulatorSessionService({
      companyId,
      sessionRef: String(req.params.sessionRef || ""),
      req,
      agentRef
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_simulator"
      },
      "ai_agent_product_simulator_end_session_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_SESSION_ENDED",
      500,
      "Não foi possível encerrar a sessão do simulador."
    );
  }
};

export const simulatorReviewMessage = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    rejectProductSimulatorForbiddenIds(req);
    const companyId = companyIdOrThrow(req);
    const userId = userIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>
    });
    const data = await ReviewAiAgentProductSimulatorMessageService({
      companyId,
      messageRef: String(req.params.messageRef || ""),
      userId,
      body: (req.body || {}) as Record<string, unknown>,
      req,
      agentRef
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_simulator"
      },
      "ai_agent_product_simulator_review_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_SIMULATOR_INVALID",
      500,
      "Não foi possível salvar a avaliação."
    );
  }
};

/** Product Credentials (Fase 2.7) */
export const listCredentials = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await ListAiAgentProductCredentialsService({
      companyId,
      req
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_credentials"
      },
      "ai_agent_product_credentials_list_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível listar as credenciais."
    );
  }
};

export const getCredential = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await GetAiAgentProductCredentialService({
      companyId,
      credentialRef: req.params.credentialRef,
      req
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_credentials"
      },
      "ai_agent_product_credentials_get_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível carregar a credencial."
    );
  }
};

export const createCredential = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await CreateAiAgentProductCredentialService({
      companyId,
      body: (req.body || {}) as Record<string, unknown>,
      req
    });
    return res.status(201).json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_credentials"
      },
      "ai_agent_product_credentials_create_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      500,
      "Não foi possível criar a credencial."
    );
  }
};

export const updateCredential = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await UpdateAiAgentProductCredentialService({
      companyId,
      credentialRef: req.params.credentialRef,
      body: (req.body || {}) as Record<string, unknown>,
      req
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_credentials"
      },
      "ai_agent_product_credentials_update_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      500,
      "Não foi possível atualizar a credencial."
    );
  }
};

export const testCredential = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await TestAiAgentProductCredentialService({
      companyId,
      credentialRef: req.params.credentialRef,
      req
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_credentials"
      },
      "ai_agent_product_credentials_test_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      500,
      "Não foi possível validar a credencial."
    );
  }
};

export const enableCredential = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await EnableAiAgentProductCredentialService({
      companyId,
      credentialRef: req.params.credentialRef,
      req
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_credentials"
      },
      "ai_agent_product_credentials_enable_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      500,
      "Não foi possível ativar a credencial."
    );
  }
};

export const disableCredential = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const data = await DisableAiAgentProductCredentialService({
      companyId,
      credentialRef: req.params.credentialRef,
      req
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product_credentials"
      },
      "ai_agent_product_credentials_disable_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CREDENTIAL_INVALID",
      500,
      "Não foi possível desativar a credencial."
    );
  }
};

export const listKnowledge = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>
    });
    const data = await ListAiAgentProductKnowledgeService({
      companyId,
      req,
      agentRef
    });
    return res.json(data);
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      {
        err: err instanceof Error ? err.message : "unknown",
        surface: "ai_agent_product"
      },
      "ai_agent_product_knowledge_list_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      500,
      "Não foi possível carregar o conhecimento do Agente de IA."
    );
  }
};

export const syncKnowledge = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    rejectArbitraryCompanyId(req);
    const companyId = companyIdOrThrow(req);
    const agentRef = extractAgentRefFromRequest({
      params: req.params as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body: req.body as Record<string, unknown>
    });
    const data = await SyncAiAgentProductKnowledgeService({
      companyId,
      req,
      agentRef,
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
      "ai_agent_product_knowledge_sync_failed"
    );
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      500,
      "Não foi possível atualizar o conhecimento do Agente de IA."
    );
  }
};
