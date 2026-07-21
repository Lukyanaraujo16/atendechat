import { Op } from "sequelize";
import AppError from "../../../errors/AppError";
import AiAgent from "../../../models/AiAgent";
import AiAgentShadowEvaluation from "../../../models/AiAgentShadowEvaluation";
import Setting from "../../../models/Setting";
import AiAgentKnowledgeSettings from "../../../models/AiAgentKnowledgeSettings";
import Whatsapp from "../../../models/Whatsapp";
import { getShadowFcMetricsSnapshot } from "./ShadowFcMetrics";
import { SHADOW_FC_COMPANY_SETTING_KEY } from "../../../config/automationShadowFcConstants";

export async function ListShadowEvaluationsService(input: {
  companyId: number;
  aiAgentId?: number;
  status?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: AiAgentShadowEvaluation[]; count: number }> {
  const where: Record<string, unknown> = { companyId: input.companyId };
  if (input.aiAgentId) where.aiAgentId = input.aiAgentId;
  if (input.status) where.status = input.status;

  return AiAgentShadowEvaluation.findAndCountAll({
    where,
    limit: input.limit,
    offset: input.offset,
    order: [["createdAt", "DESC"]]
  });
}

export async function GetShadowEvaluationService(input: {
  companyId: number;
  id: number;
}): Promise<AiAgentShadowEvaluation> {
  const row = await AiAgentShadowEvaluation.findOne({
    where: { id: input.id, companyId: input.companyId }
  });
  if (!row) {
    throw new AppError("ERR_NO_PERMISSION", 404, "Avaliação Shadow não encontrada.");
  }
  return row;
}

export async function GetShadowFcDashboardService(input: {
  companyId: number;
}): Promise<{
  metrics: ReturnType<typeof getShadowFcMetricsSnapshot>;
  recent: AiAgentShadowEvaluation[];
  config: {
    companyEnabled: boolean;
    agentsEnabled: number;
    connectionsEnabled: number;
    agents: Array<{
      id: number;
      name: string;
      functionCallingShadow: boolean;
    }>;
    connections: Array<{
      id: number;
      name: string;
      functionCallingShadow: boolean;
    }>;
  };
}> {
  const [
    companySetting,
    agentsEnabled,
    connectionsEnabled,
    recent,
    agents,
    agentSettings,
    connections
  ] = await Promise.all([
    Setting.findOne({
      where: {
        companyId: input.companyId,
        key: SHADOW_FC_COMPANY_SETTING_KEY
      }
    }),
    AiAgentKnowledgeSettings.count({
      where: {
        companyId: input.companyId,
        functionCallingShadow: true
      }
    }),
    Whatsapp.count({
      where: {
        companyId: input.companyId,
        functionCallingShadow: true
      }
    }),
    AiAgentShadowEvaluation.findAll({
      where: { companyId: input.companyId },
      order: [["createdAt", "DESC"]],
      limit: 20,
      attributes: [
        "id",
        "status",
        "provider",
        "model",
        "toolCallCount",
        "usedTools",
        "usedKnowledge",
        "latencyMs",
        "totalTokens",
        "estimatedCostUsd",
        "createdAt",
        "aiAgentId",
        "ticketId"
      ]
    }),
    AiAgent.findAll({
      where: { companyId: input.companyId },
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
      limit: 100
    }),
    AiAgentKnowledgeSettings.findAll({
      where: { companyId: input.companyId },
      attributes: ["aiAgentId", "functionCallingShadow"]
    }),
    Whatsapp.findAll({
      where: { companyId: input.companyId },
      attributes: ["id", "name", "functionCallingShadow"],
      order: [["name", "ASC"]],
      limit: 100
    })
  ]);

  const agentFcMap = new Map(
    agentSettings.map(s => [s.aiAgentId, s.functionCallingShadow === true])
  );

  return {
    metrics: getShadowFcMetricsSnapshot(input.companyId),
    recent,
    config: {
      companyEnabled:
        companySetting?.value === "enabled" ||
        companySetting?.value === "true",
      agentsEnabled,
      connectionsEnabled,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        functionCallingShadow: agentFcMap.get(a.id) === true
      })),
      connections: connections.map(c => ({
        id: c.id,
        name: c.name,
        functionCallingShadow: c.functionCallingShadow === true
      }))
    }
  };
}

export async function UpsertShadowFcCompanySettingService(input: {
  companyId: number;
  enabled: boolean;
}): Promise<{ key: string; enabled: boolean }> {
  const value = input.enabled ? "enabled" : "disabled";
  const [row] = await Setting.findOrCreate({
    where: {
      companyId: input.companyId,
      key: SHADOW_FC_COMPANY_SETTING_KEY
    },
    defaults: {
      companyId: input.companyId,
      key: SHADOW_FC_COMPANY_SETTING_KEY,
      value
    }
  });
  await row.update({ value });
  return { key: SHADOW_FC_COMPANY_SETTING_KEY, enabled: input.enabled };
}

export async function UpsertShadowFcAgentSettingService(input: {
  companyId: number;
  aiAgentId: number;
  enabled: boolean;
  userId?: number | null;
}): Promise<{ functionCallingShadow: boolean }> {
  const [row] = await AiAgentKnowledgeSettings.findOrCreate({
    where: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId
    },
    defaults: {
      companyId: input.companyId,
      aiAgentId: input.aiAgentId,
      enabled: false,
      functionCallingShadow: false,
      updatedBy: input.userId ?? null,
      createdBy: input.userId ?? null
    }
  });
  await row.update({
    functionCallingShadow: input.enabled === true,
    updatedBy: input.userId ?? row.updatedBy
  });
  return { functionCallingShadow: row.functionCallingShadow === true };
}

export async function UpsertShadowFcConnectionSettingService(input: {
  companyId: number;
  whatsappId: number;
  enabled: boolean;
}): Promise<{ functionCallingShadow: boolean }> {
  const wa = await Whatsapp.findOne({
    where: { id: input.whatsappId, companyId: input.companyId }
  });
  if (!wa) {
    throw new AppError("ERR_NO_PERMISSION", 404, "Conexão não encontrada.");
  }
  await wa.update({ functionCallingShadow: input.enabled === true });
  return { functionCallingShadow: wa.functionCallingShadow === true };
}

export async function countShadowEvaluationsSince(input: {
  companyId: number;
  since: Date;
}): Promise<number> {
  return AiAgentShadowEvaluation.count({
    where: {
      companyId: input.companyId,
      createdAt: { [Op.gte]: input.since }
    }
  });
}
