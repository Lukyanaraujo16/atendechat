import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";

export const AI_AGENT_PLAN_FEATURE_KEY = "automation.ai_agent";

const PLAN_FEATURE_DISABLED_MSG =
  "Este recurso não está disponível no seu plano.";

function parseOptionalAgentId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const id = Number(value);
  if (!Number.isFinite(id) || !Number.isInteger(id) || id <= 0) {
    throw new AppError("ERR_VALIDATION_ERROR", 400, "Agente de IA inválido.");
  }
  return id;
}

function parseEnabledFlag(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === true || value === "true" || value === 1 || value === "1";
}

async function assertAgentBelongsToCompany(
  companyId: number,
  agentId: number
): Promise<void> {
  const agent = await AiAgent.findOne({
    where: { id: agentId, companyId }
  });
  if (!agent) {
    throw new AppError(
      "ERR_AI_AGENT_NOT_FOUND",
      404,
      "Agente de IA não encontrado nesta empresa."
    );
  }
}

/**
 * Normaliza aiAgentId/aiAgentEnabled para persistência na conexão WhatsApp.
 * Exige plano automation.ai_agent para vincular ou ativar.
 */
export async function resolveAiAgentWhatsappFields(input: {
  companyId: number;
  planHasAiAgent: boolean;
  aiAgentId?: unknown;
  aiAgentEnabled?: unknown;
  existingAiAgentId?: number | null;
  existingAiAgentEnabled?: boolean;
}): Promise<{ aiAgentId: number | null; aiAgentEnabled: boolean }> {
  const existingId = input.existingAiAgentId ?? null;
  const existingEnabled = input.existingAiAgentEnabled === true;

  const idProvided = input.aiAgentId !== undefined;
  const enabledProvided = input.aiAgentEnabled !== undefined;

  let nextId = idProvided
    ? parseOptionalAgentId(input.aiAgentId)
    : existingId;
  let nextEnabled = enabledProvided
    ? parseEnabledFlag(input.aiAgentEnabled, false)
    : existingEnabled;

  if (!input.planHasAiAgent) {
    const triesEnable = enabledProvided && nextEnabled;
    const triesLink = idProvided && nextId != null;
    const differsFromExisting =
      (idProvided && nextId !== existingId) ||
      (enabledProvided && nextEnabled !== existingEnabled);

    if (triesEnable || triesLink || (differsFromExisting && (nextId != null || nextEnabled))) {
      throw new AppError(
        "ERR_PLAN_FEATURE_DISABLED",
        403,
        PLAN_FEATURE_DISABLED_MSG
      );
    }

    return {
      aiAgentId: existingId,
      aiAgentEnabled: existingEnabled && existingId != null ? existingEnabled : false
    };
  }

  if (nextEnabled && nextId == null) {
    throw new AppError(
      "ERR_VALIDATION_ERROR",
      400,
      "Selecione um agente de IA para ativar nesta conexão."
    );
  }

  if (nextId == null) {
    nextEnabled = false;
  }

  if (nextId != null) {
    await assertAgentBelongsToCompany(input.companyId, nextId);
  }

  return {
    aiAgentId: nextId,
    aiAgentEnabled: nextEnabled
  };
}
