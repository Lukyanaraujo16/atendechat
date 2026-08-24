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
import {
  encodeAgentRef,
  resolveAiAgentProductAgentForOperation,
  throwIfAiAgentArchived
} from "./aiAgentProductAgentRef";
import {
  scopeAiAgentProductSnapshotToAgent
} from "./ResolveAiAgentProductAgentService";

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
  agentRef?: unknown;
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
  const agentRef =
    input.agentRef !== undefined ? input.agentRef : input.body?.agentRef;

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

  const scoped = await resolveAiAgentProductAgentForOperation({
    companyId,
    agentRef
  });

  if (command === "activate_shadow" || command === "activate_live") {
    if (scoped.kind === "not_created") {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_CONTEXT_INVALID",
        409,
        "Crie o Agente de IA antes de ativar."
      );
    }
    const snapshotBase = await buildAiAgentProductSnapshot({
      companyId,
      req: input.req,
      availability
    });
    const snapshot = scopeAiAgentProductSnapshotToAgent(
      snapshotBase,
      scoped.agentId
    );
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
  let operatedAgentId: number | null =
    scoped.kind === "resolved" ? scoped.agentId : null;

  await sequelize.transaction(async transaction => {
    if (scoped.kind === "not_created") {
      if (command === "deactivate") {
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

    const agent = await AiAgent.findOne({
      where: { id: scoped.agentId, companyId },
      lock: Transaction.LOCK.UPDATE,
      transaction
    });
    if (!agent) {
      throw new AppError(
        "ERR_AI_AGENT_PRODUCT_AGENT_NOT_FOUND",
        404,
        "Agente de IA não encontrado."
      );
    }
    throwIfAiAgentArchived(agent);

    operatedAgentId = agent.id;
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

      // Idempotente: agente e conexões já sem operação automática.
      // O modo live/shadow nas conexões é preservado para reativação (Fase 2.19.1).
      const agentAlreadyOff = agent.enabled !== true;
      const connectionsAlreadyOff = linked.every(
        w => w.aiAgentEnabled !== true
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
        if (wa.aiAgentEnabled === true) {
          // Preserva aiAgentMode (live|shadow|dry_run) + aiAgentId.
          // Runtime continua gated por agent.enabled === false.
          await wa.update({ aiAgentEnabled: false }, { transaction });
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
    availability,
    agentRef:
      operatedAgentId != null ? encodeAgentRef(operatedAgentId) : agentRef
  });

  return serializeAiAgentProductCommandResult({
    command,
    changed,
    affectedConnections: affected,
    summary
  });
}
