import AppError from "../../errors/AppError";
import { isAiAgentArchived } from "../../helpers/isAiAgentArchived";
import AiAgent from "../../models/AiAgent";
import {
  AiAgentRuntimeMode,
  parseAiAgentRuntimeMode,
  resolveWhatsappAiAgentRuntimeMode
} from "./aiAgentRuntimeMode";

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
  if (!agent || isAiAgentArchived(agent)) {
    throw new AppError(
      "ERR_AI_AGENT_NOT_FOUND",
      404,
      "Agente de IA não encontrado nesta empresa."
    );
  }
}

export type ResolvedAiAgentWhatsappFields = {
  aiAgentId: number | null;
  aiAgentEnabled: boolean;
  aiAgentMode: AiAgentRuntimeMode;
};

/**
 * Normaliza aiAgentId / aiAgentMode para persistência na conexão WhatsApp.
 */
export async function resolveAiAgentWhatsappFields(input: {
  companyId: number;
  planHasAiAgent: boolean;
  aiAgentId?: unknown;
  aiAgentEnabled?: unknown;
  aiAgentMode?: unknown;
  existingAiAgentId?: number | null;
  existingAiAgentEnabled?: boolean;
  existingAiAgentMode?: string | null;
}): Promise<ResolvedAiAgentWhatsappFields> {
  const existingId = input.existingAiAgentId ?? null;
  const existingEnabled = input.existingAiAgentEnabled === true;
  const existingMode = resolveWhatsappAiAgentRuntimeMode({
    aiAgentMode: input.existingAiAgentMode,
    aiAgentEnabled: existingEnabled,
    aiAgentId: existingId
  });

  const idProvided = input.aiAgentId !== undefined;
  const enabledProvided = input.aiAgentEnabled !== undefined;
  const modeProvided = input.aiAgentMode !== undefined;

  let nextId = idProvided
    ? parseOptionalAgentId(input.aiAgentId)
    : existingId;
  let nextMode: AiAgentRuntimeMode = modeProvided
    ? parseAiAgentRuntimeMode(input.aiAgentMode)
    : existingMode;

  if (!modeProvided && enabledProvided) {
    const enabled = parseEnabledFlag(input.aiAgentEnabled, false);
    nextMode = enabled ? "dry_run" : "disabled";
  }

  if (!input.planHasAiAgent) {
    const triesActivate = modeProvided && nextMode !== "disabled";
    const triesLink = idProvided && nextId != null;
    const differsFromExisting =
      (idProvided && nextId !== existingId) ||
      (modeProvided && nextMode !== existingMode);

    if (triesActivate || triesLink || differsFromExisting) {
      throw new AppError(
        "ERR_PLAN_FEATURE_DISABLED",
        403,
        PLAN_FEATURE_DISABLED_MSG
      );
    }

    return {
      aiAgentId: existingId,
      aiAgentEnabled: existingMode !== "disabled",
      aiAgentMode: existingMode
    };
  }

  if (nextMode === "shadow" || nextMode === "dry_run" || nextMode === "live") {
    if (nextId == null) {
      throw new AppError(
        "ERR_VALIDATION_ERROR",
        400,
        "Selecione um agente de IA para ativar nesta conexão."
      );
    }
    await assertAgentBelongsToCompany(input.companyId, nextId);
  } else {
    nextMode = "disabled";
  }

  if (nextId == null) {
    nextMode = "disabled";
  }

  if (nextId != null) {
    await assertAgentBelongsToCompany(input.companyId, nextId);
  }

  const nextEnabled = nextMode !== "disabled";

  return {
    aiAgentId: nextId,
    aiAgentEnabled: nextEnabled,
    aiAgentMode: nextMode
  };
}
