import { Request } from "express";
import AiAgentProfile from "../../models/AiAgentProfile";
import {
  AiAgentProductSimulatorBootstrap
} from "../../types/aiAgentProduct";
import { listAiAgentSimulationSessions } from "../AiAgentService/AiAgentSimulationService";
import {
  resolveProductSimulatorCapability
} from "./aiAgentProductSimulatorHelpers";
import {
  serializeAiAgentProductSimulatorBootstrap,
  serializeAiAgentProductSimulatorSession
} from "./serializeAiAgentProductSimulator";

export default async function GetAiAgentProductSimulatorService(input: {
  companyId: number;
  req?: Request;
}): Promise<AiAgentProductSimulatorBootstrap> {
  const companyId = Number(input.companyId);
  const cap = await resolveProductSimulatorCapability(companyId, input.req);

  let scenarioSegment: string | null = null;
  let sessions: ReturnType<typeof serializeAiAgentProductSimulatorSession>[] =
    [];

  if (cap.agentRow) {
    const profile = await AiAgentProfile.findOne({
      where: { companyId, aiAgentId: cap.agentRow.id },
      attributes: ["businessSegment"]
    });
    scenarioSegment = profile?.businessSegment
      ? String(profile.businessSegment)
      : null;

    if (cap.resolution === "resolved") {
      try {
        const listed = await listAiAgentSimulationSessions({
          companyId,
          aiAgentId: cap.agentRow.id
        });
        sessions = (listed.sessions || []).map(s =>
          serializeAiAgentProductSimulatorSession({
            id: s.id,
            status: s.status,
            provider: s.provider,
            model: s.model,
            messageCount: s.messageCount,
            startedAt: s.startedAt,
            endedAt: s.endedAt
          })
        );
      } catch {
        sessions = [];
      }
    }
  }

  return serializeAiAgentProductSimulatorBootstrap({
    available: cap.available,
    reason: cap.reason,
    agentScope: cap.agentScope,
    agent: {
      name: cap.agentRow?.name != null ? String(cap.agentRow.name) : null,
      description:
        cap.agentRow?.description != null
          ? String(cap.agentRow.description)
          : null,
      status: cap.readiness?.status ?? null,
      mode: cap.readiness?.mode ?? null
    },
    capabilities: {
      canSimulate: cap.canSimulate,
      canReview: cap.canReview
    },
    provider: {
      label: cap.providerLabel,
      modelLabel: cap.modelLabel
    },
    scenarioSegment,
    sessions
  });
}
