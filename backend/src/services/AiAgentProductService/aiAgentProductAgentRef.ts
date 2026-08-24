import AppError from "../../errors/AppError";
import {
  isAiAgentArchived,
  withAiAgentNotArchived
} from "../../helpers/isAiAgentArchived";
import AiAgent from "../../models/AiAgent";

/**
 * Product multiagente (Fase 2.9A).
 * agentRef = identificador comercial opaco (internamente String(id)).
 */

export const ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED =
  "ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED";

export const ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND =
  "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND";

export const ERR_AI_AGENT_PRODUCT_ARCHIVED = "ERR_AI_AGENT_PRODUCT_ARCHIVED";

export function throwIfAiAgentArchived(
  agent: { archivedAt?: Date | string | null } | null
): void {
  if (isAiAgentArchived(agent)) {
    throw new AppError(
      ERR_AI_AGENT_PRODUCT_ARCHIVED,
      404,
      "Este agente foi arquivado."
    );
  }
}

export function encodeAgentRef(id: number): string {
  return String(id);
}

/**
 * Valida agentRef como inteiro positivo em string.
 * Ausente/vazio → null (compat legado).
 * Formato inválido → 400.
 */
export function parseOptionalAgentRef(ref: unknown): number | null {
  if (ref === undefined || ref === null) return null;
  const raw = String(ref).trim();
  if (raw === "") return null;
  if (!/^\d+$/.test(raw)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "Referência de agente inválida."
    );
  }
  const id = Number(raw);
  if (!Number.isFinite(id) || id <= 0 || !Number.isInteger(id)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONFIGURATION_INVALID",
      400,
      "Referência de agente inválida."
    );
  }
  return id;
}

export function parseRequiredAgentRef(ref: unknown): number {
  const id = parseOptionalAgentRef(ref);
  if (id == null) {
    throw new AppError(
      ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED,
      409,
      "Selecione um Agente de IA para continuar."
    );
  }
  return id;
}

/**
 * Lookup tenant-safe. Cross-tenant / inexistente → mesmo 404 (sem enumeração).
 */
export async function findAiAgentProductByRefOrThrow(input: {
  companyId: number;
  agentRef: unknown;
}): Promise<AiAgent> {
  const agentId = parseRequiredAgentRef(input.agentRef);
  const agent = await AiAgent.findOne({
    where: { id: agentId, companyId: input.companyId }
  });
  if (!agent) {
    throw new AppError(
      ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND,
      404,
      "Agente de IA não encontrado."
    );
  }
  throwIfAiAgentArchived(agent);
  return agent;
}

export type ProductAgentResolution =
  | { kind: "not_created" }
  | {
      kind: "resolved";
      agent: AiAgent;
      agentId: number;
      agentRef: string;
    };

/**
 * Resolução operacional multiagente.
 *
 * - Com agentRef → sempre aquele agente (404 se não for da empresa).
 * - Sem agentRef (compat frontend singular publicado):
 *   - 0 agentes → not_created
 *   - 1 agente → resolved
 *   - ≥2 → ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED
 */
export async function resolveAiAgentProductAgentForOperation(input: {
  companyId: number;
  agentRef?: unknown;
}): Promise<ProductAgentResolution> {
  const companyId = Number(input.companyId);
  const explicitId = parseOptionalAgentRef(input.agentRef);

  if (explicitId != null) {
    const agent = await AiAgent.findOne({
      where: { id: explicitId, companyId }
    });
    if (!agent) {
      throw new AppError(
        ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND,
        404,
        "Agente de IA não encontrado."
      );
    }
    throwIfAiAgentArchived(agent);
    return {
      kind: "resolved",
      agent,
      agentId: agent.id,
      agentRef: encodeAgentRef(agent.id)
    };
  }

  const agents = await AiAgent.findAll({
    where: withAiAgentNotArchived({ companyId }),
    order: [["id", "ASC"]],
    attributes: ["id", "name", "enabled", "model", "aiProviderCredentialId", "companyId", "systemPrompt"]
  });

  if (agents.length === 0) {
    return { kind: "not_created" };
  }

  if (agents.length === 1) {
    const agent = agents[0];
    return {
      kind: "resolved",
      agent,
      agentId: agent.id,
      agentRef: encodeAgentRef(agent.id)
    };
  }

  throw new AppError(
    ERR_AI_AGENT_PRODUCT_AGENT_REF_REQUIRED,
    409,
    "Selecione um Agente de IA para continuar."
  );
}

/**
 * Extrai agentRef de params, query ou body (nessa ordem).
 * Não trata agentId/aiAgentId — contrato público único = agentRef.
 */
export function extractAgentRefFromRequest(input: {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}): unknown {
  if (input.params && Object.prototype.hasOwnProperty.call(input.params, "agentRef")) {
    return input.params.agentRef;
  }
  if (input.query && Object.prototype.hasOwnProperty.call(input.query, "agentRef")) {
    return input.query.agentRef;
  }
  if (input.body && Object.prototype.hasOwnProperty.call(input.body, "agentRef")) {
    return input.body.agentRef;
  }
  return undefined;
}
