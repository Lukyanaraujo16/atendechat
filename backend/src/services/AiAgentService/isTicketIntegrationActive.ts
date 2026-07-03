import Ticket from "../../models/Ticket";
import QueueIntegrations from "../../models/QueueIntegrations";
import { isFlowAutomationActive } from "./isFlowAutomationActive";

export type TicketIntegrationActiveResult = {
  active: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
};

/**
 * Indica se há integração/automação de fila realmente ativa no ticket.
 * Não bloqueia por flags residuais (`useIntegration` sem sessão Typebot, etc.).
 */
export async function isTicketIntegrationActive(
  ticket: Ticket
): Promise<TicketIntegrationActiveResult> {
  if (ticket.useIntegration !== true || ticket.integrationId == null) {
    return {
      active: false,
      evidence: {
        useIntegration: ticket.useIntegration === true,
        integrationId: ticket.integrationId ?? null
      }
    };
  }

  const integration = await QueueIntegrations.findByPk(ticket.integrationId, {
    attributes: ["id", "type"]
  });

  if (!integration) {
    return {
      active: false,
      evidence: {
        integrationId: ticket.integrationId,
        integrationRecordMissing: true
      }
    };
  }

  const integrationType = String(integration.type || "").toLowerCase();

  if (integrationType === "typebot") {
    const hasSession =
      ticket.typebotSessionId != null &&
      String(ticket.typebotSessionId).trim() !== "";
    const active = ticket.typebotStatus === true && hasSession;
    return {
      active,
      reason: active ? "typebot" : undefined,
      evidence: {
        integrationType: "typebot",
        typebotStatus: ticket.typebotStatus === true,
        hasSession
      }
    };
  }

  if (integrationType === "flowbuilder") {
    const flow = isFlowAutomationActive(ticket);
    return {
      active: flow.active,
      reason: flow.active ? "flowbuilder_integration" : undefined,
      evidence: {
        integrationType: "flowbuilder",
        ...(flow.evidence || {})
      }
    };
  }

  if (integrationType === "n8n" || integrationType === "webhook") {
    return {
      active: true,
      reason: integrationType,
      evidence: { integrationType }
    };
  }

  if (ticket.promptId != null) {
    return {
      active: true,
      reason: "openai_prompt",
      evidence: {
        integrationType: integrationType || "unknown",
        hasPromptId: true
      }
    };
  }

  return {
    active: true,
    reason: integrationType || "integration",
    evidence: { integrationType: integrationType || "unknown" }
  };
}
