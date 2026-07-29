import { Request } from "express";
import { Transaction } from "sequelize";
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import AiAgent from "../../models/AiAgent";
import Whatsapp from "../../models/Whatsapp";
import {
  AI_AGENT_PRODUCT_COMMANDS,
  AiAgentProductAffectedConnections,
  AiAgentProductCommand,
  AiAgentProductCommandResult
} from "../../types/aiAgentProduct";
import {
  resolveWhatsappAiAgentRuntimeMode,
  AiAgentRuntimeMode
} from "../AiAgentService/aiAgentRuntimeMode";
import {
  computeAiAgentProductReadiness
} from "./AgentReadinessService";
import GetAiAgentProductSummaryService, {
  buildAiAgentProductSnapshot,
  resolveAiAgentProductAvailability
} from "./GetAiAgentProductSummaryService";
import { serializeAiAgentProductCommandResult } from "./serializeAiAgentProduct";
import {
  buildAffectedConnections,
  isWhatsappConnected,
  resolveAffectedFromMode,
  sortConnectionsByIdAsc
} from "./aiAgentProductConnectionScope";
import { resolveAiAgentProductAgentContextFromRows } from "./ResolveAiAgentProductContextService";

function rejectClientEntityIds(body: Record<string, unknown> | undefined): void {
  if (!body || typeof body !== "object") return;
  if (
    body.companyId != null ||
    body.agentId != null ||
    body.whatsappId != null ||
    body.aiAgentId != null
  ) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      403,
      "Contexto da empresa inválido."
    );
  }
}

function parseCommand(raw: unknown): AiAgentProductCommand {
  const value = String(raw || "").trim();
  if (!AI_AGENT_PRODUCT_COMMANDS.includes(value as AiAgentProductCommand)) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_COMMAND_NOT_ALLOWED",
      400,
      "Comando do Agente de IA não permitido."
    );
  }
  return value as AiAgentProductCommand;
}

function isSetupStructurallyComplete(
  snapshot: Awaited<ReturnType<typeof buildAiAgentProductSnapshot>>
): boolean {
  const { readiness, resolution } = computeAiAgentProductReadiness(snapshot);
  if (resolution !== "resolved") return false;
  if (readiness.status === "attention_required") return false;
  const required = [
    "plan",
    "agent",
    "provider",
    "credential",
    "model",
    "instructions",
    "connection"
  ];
  return required.every(key => {
    const check = readiness.checks.find(c => c.key === key);
    return check?.status === "complete";
  });
}

/**
 * Lock determinístico de todos os candidatos da empresa (ORDER BY id ASC).
 * A seleção comercial é exclusiva via ResolveAiAgentProductContextService (Estratégia A).
 */
async function lockEligibleAgents(
  companyId: number,
  transaction: Transaction
): Promise<AiAgent[]> {
  return AiAgent.findAll({
    where: { companyId },
    order: [["id", "ASC"]],
    lock: Transaction.LOCK.UPDATE,
    transaction
  });
}

/** Lock de conexões vinculadas ordenado por id ASC. */
async function lockLinkedWhatsapps(
  companyId: number,
  agentId: number,
  transaction: Transaction
): Promise<Whatsapp[]> {
  const rows = await Whatsapp.findAll({
    where: { companyId, aiAgentId: agentId },
    order: [["id", "ASC"]],
    lock: Transaction.LOCK.UPDATE,
    transaction
  });
  return sortConnectionsByIdAsc(rows);
}

function assertAllLinkedConnected(linked: Whatsapp[]): void {
  if (!linked.length) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONNECTION_UNAVAILABLE",
      409,
      "Vincule uma conexão WhatsApp ao Agente de IA antes de ativar."
    );
  }
  const disconnected = linked.filter(w => !isWhatsappConnected(w.status));
  if (disconnected.length > 0) {
    const names = disconnected
      .map(w => String(w.name || "").trim() || "—")
      .join(", ");
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONNECTION_UNAVAILABLE",
      409,
      `Todas as conexões vinculadas precisam estar conectadas antes de ativar. Desconectadas: ${names}.`
    );
  }
}

function toRuntimeSnapshots(linked: Whatsapp[]): Array<{
  runtimeMode: AiAgentRuntimeMode;
}> {
  return linked.map(w => ({
    runtimeMode: resolveWhatsappAiAgentRuntimeMode(w)
  }));
}

export default async function ExecuteAiAgentProductCommandService(input: {
  companyId: number;
  req: Request;
  body?: Record<string, unknown>;
}): Promise<AiAgentProductCommandResult> {
  if (input.companyId == null || !Number.isFinite(Number(input.companyId))) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
      403,
      "Contexto da empresa inválido."
    );
  }

  rejectClientEntityIds(input.body);
  const command = parseCommand(input.body?.command);
  const companyId = Number(input.companyId);

  const availability = await resolveAiAgentProductAvailability({
    companyId,
    req: input.req
  });

  if (!availability.enabledByPlan) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_NOT_AVAILABLE",
      403,
      "O Agente de IA não está disponível no plano."
    );
  }
  if (!availability.accessibleByUser) {
    throw new AppError(
      "ERR_AI_AGENT_PRODUCT_ACCESS_DENIED",
      403,
      "Acesso ao Agente de IA não permitido para este usuário."
    );
  }

  if (command === "activate_shadow" || command === "activate_live") {
    const snapshot = await buildAiAgentProductSnapshot({
      companyId,
      req: input.req,
      availability
    });
    const { resolution } = computeAiAgentProductReadiness(snapshot);
    if (resolution === "ambiguous") {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
        409,
        "Existem várias configurações de Agente de IA. Revise antes de ativar."
      );
    }
    if (resolution === "not_created") {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        409,
        "Crie o Agente de IA antes de ativar."
      );
    }
    if (!isSetupStructurallyComplete(snapshot)) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_NOT_READY",
        409,
        "Conclua a configuração do Agente de IA antes de ativar."
      );
    }
  }

  let changed = false;
  let affected: AiAgentProductAffectedConnections = {
    scope: "all_linked",
    count: 0,
    names: [],
    fromMode: "off",
    toMode: "off"
  };

  await sequelize.transaction(async transaction => {
    const candidates = await lockEligibleAgents(companyId, transaction);
    const resolved = resolveAiAgentProductAgentContextFromRows(candidates);

    if (resolved.resolution === "ambiguous") {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_AMBIGUOUS",
        409,
        "Existem várias configurações de Agente de IA. Revise antes de continuar."
      );
    }

    if (resolved.resolution === "not_created") {
      if (command === "deactivate") {
        // No-op seguro: não há agente comercial para desativar
        changed = false;
        affected = {
          scope: "all_linked",
          count: 0,
          names: [],
          fromMode: "off",
          toMode: "off"
        };
        return;
      }
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        409,
        "Crie o Agente de IA antes de executar este comando."
      );
    }

    const agent = resolved.agent!;

    const linked = await lockLinkedWhatsapps(companyId, agent.id, transaction);
    const fromMode = resolveAffectedFromMode(toRuntimeSnapshots(linked));

    if (command === "deactivate") {
      const toMode = "off" as const;
      affected = buildAffectedConnections({
        linked: linked.map(w => ({
          id: w.id,
          name: w.name,
          status: w.status
        })),
        fromMode,
        toMode
      });

      const agentAlreadyOff = agent.enabled !== true;
      const connectionsAlreadyOff = linked.every(
        w => resolveWhatsappAiAgentRuntimeMode(w) === "disabled"
      );
      if (agentAlreadyOff && connectionsAlreadyOff) {
        changed = false;
        return;
      }

      if (agent.enabled === true) {
        await agent.update({ enabled: false }, { transaction });
        changed = true;
      }
      for (const wa of linked) {
        const mode = resolveWhatsappAiAgentRuntimeMode(wa);
        if (mode !== "disabled" || wa.aiAgentEnabled === true) {
          await wa.update(
            {
              aiAgentMode: "disabled",
              aiAgentEnabled: false
            },
            { transaction }
          );
          changed = true;
        }
      }
      return;
    }

    const targetMode = command === "activate_live" ? "live" : "shadow";
    assertAllLinkedConnected(linked);

    affected = buildAffectedConnections({
      linked: linked.map(w => ({
        id: w.id,
        name: w.name,
        status: w.status
      })),
      fromMode,
      toMode: targetMode
    });

    const already =
      agent.enabled === true &&
      linked.every(w => resolveWhatsappAiAgentRuntimeMode(w) === targetMode);

    if (already) {
      changed = false;
      return;
    }

    if (agent.enabled !== true) {
      await agent.update({ enabled: true }, { transaction });
      changed = true;
    }

    for (const wa of linked) {
      const current = resolveWhatsappAiAgentRuntimeMode(wa);
      if (
        current !== targetMode ||
        wa.aiAgentEnabled !== true ||
        wa.aiAgentId !== agent.id
      ) {
        await wa.update(
          {
            aiAgentId: agent.id,
            aiAgentMode: targetMode,
            aiAgentEnabled: true
          },
          { transaction }
        );
        changed = true;
      }
    }
  });

  const summary = await GetAiAgentProductSummaryService({
    companyId,
    req: input.req,
    availability
  });

  return serializeAiAgentProductCommandResult({
    command,
    changed,
    affectedConnections: affected,
    summary
  });
}
