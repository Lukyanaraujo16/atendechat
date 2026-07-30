import { NextFunction, Request, Response } from "express";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";

/** Mutação comercial legada de AI Agent descontinuada (HTTP 410). */
export const ERR_AI_AGENT_LEGACY_MUTATION_DISABLED =
  "ERR_AI_AGENT_LEGACY_MUTATION_DISABLED";

/** Mutação comercial legada de credenciais descontinuada (HTTP 410). */
export const ERR_AI_PROVIDER_CREDENTIAL_LEGACY_MUTATION_DISABLED =
  "ERR_AI_PROVIDER_CREDENTIAL_LEGACY_MUTATION_DISABLED";

/** Status preferido: operação comercial não disponível neste endpoint. */
export const LEGACY_COMMERCIAL_MUTATION_HTTP_STATUS = 410;

export type LegacyAiAgentMutationDomain =
  | "ai_agent"
  | "ai_agent_knowledge"
  | "ai_agent_simulator"
  | "ai_agent_shadow_review"
  | "ai_provider_credential";

const AGENT_CLIENT_MESSAGE =
  "Esta operação comercial do Agente de IA não está mais disponível neste endpoint. Utilize a área AI Agent.";

const CREDENTIAL_CLIENT_MESSAGE =
  "Esta operação comercial de credenciais não está mais disponível neste endpoint. Utilize a área AI Agent.";

function resolveRoute(req: Request): string {
  const path =
    typeof req.originalUrl === "string"
      ? req.originalUrl.split("?")[0]
      : `${req.baseUrl || ""}${req.path || ""}`;
  return `${req.method} ${path}`;
}

function logBlocked(
  req: Request,
  input: {
    errorCode: string;
    legacyDomain: LegacyAiAgentMutationDomain;
  }
): void {
  const headerRid = req.headers?.["x-request-id"];
  const requestId =
    typeof headerRid === "string"
      ? headerRid
      : Array.isArray(headerRid)
        ? headerRid[0] ?? null
        : null;

  logger.info(
    {
      event: "ai_agent.legacy_mutation_blocked",
      method: req.method,
      route: resolveRoute(req),
      companyId: req.user?.companyId ?? null,
      userId: req.user?.id ?? null,
      role: req.user?.profile ?? null,
      legacyDomain: input.legacyDomain,
      errorCode: input.errorCode,
      requestId
    },
    "ai_agent.legacy_mutation_blocked"
  );
}

/**
 * Bloqueia mutações comerciais legadas de AI Agent (CRUD, profile, knowledge,
 * simulator, shadow review comercial). Executar após isAuth + feature gate.
 * Sem side effect: controller/service não são alcançados.
 */
export function rejectLegacyAiAgentCommercialMutation(
  domain:
    | "ai_agent"
    | "ai_agent_knowledge"
    | "ai_agent_simulator"
    | "ai_agent_shadow_review" = "ai_agent"
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    logBlocked(req, {
      errorCode: ERR_AI_AGENT_LEGACY_MUTATION_DISABLED,
      legacyDomain: domain
    });
    next(
      new AppError(
        ERR_AI_AGENT_LEGACY_MUTATION_DISABLED,
        LEGACY_COMMERCIAL_MUTATION_HTTP_STATUS,
        AGENT_CLIENT_MESSAGE
      )
    );
  };
}

/**
 * Bloqueia mutações comerciais legadas de credenciais
 * (POST/PUT/DELETE/test). GET list permanece para Knowledge Base.
 */
export function rejectLegacyAiProviderCredentialCommercialMutation() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    logBlocked(req, {
      errorCode: ERR_AI_PROVIDER_CREDENTIAL_LEGACY_MUTATION_DISABLED,
      legacyDomain: "ai_provider_credential"
    });
    next(
      new AppError(
        ERR_AI_PROVIDER_CREDENTIAL_LEGACY_MUTATION_DISABLED,
        LEGACY_COMMERCIAL_MUTATION_HTTP_STATUS,
        CREDENTIAL_CLIENT_MESSAGE
      )
    );
  };
}
