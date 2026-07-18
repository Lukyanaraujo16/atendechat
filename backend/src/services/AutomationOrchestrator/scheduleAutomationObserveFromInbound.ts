import { logger } from "../../utils/logger";
import {
  AUTOMATION_DEFAULT_CONTROL_MODE,
  AutomationControlMode
} from "../../config/automationOrchestratorConstants";
import { resolveWhatsappAiAgentRuntimeMode } from "../AiAgentService/aiAgentRuntimeMode";
import { buildExecutionContextFromInbound } from "./buildExecutionContext";
import { safeStartAutomationExecution } from "./StartAutomationExecutionService";
import { ResolveOrchestratorSettingsService } from "./activation/ResolveOrchestratorSettingsService";

export type ScheduleAutomationObserveFromInboundInput = {
  companyId: number;
  ticket: Record<string, unknown>;
  contact: Record<string, unknown>;
  whatsapp?: Record<string, unknown> | null;
  messageId?: string | null;
  body?: string | null;
  fromMe?: boolean;
  hasText?: boolean;
  isGroup?: boolean;
  integrationActive?: boolean;
  channel?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Hook fail-open: agenda execução conforme controlMode das settings (default observe).
 */
export async function scheduleAutomationObserveFromInbound(
  input: ScheduleAutomationObserveFromInboundInput
): Promise<void> {
  try {
    const ticketRecord = input.ticket;
    const ticket = {
      ...ticketRecord,
      isGroup: input.isGroup === true || ticketRecord.isGroup === true
    };

    const whatsapp = input.whatsapp || null;
    const whatsappId =
      whatsapp?.id != null
        ? Number(whatsapp.id)
        : ticketRecord.whatsappId != null
          ? Number(ticketRecord.whatsappId)
          : null;
    const aiAgentId =
      whatsapp?.aiAgentId != null
        ? Number(whatsapp.aiAgentId)
        : ticketRecord.aiAgentId != null
          ? Number(ticketRecord.aiAgentId)
          : null;

    const settings = await ResolveOrchestratorSettingsService({
      companyId: input.companyId,
      whatsappId,
      aiAgentId
    });

    const controlMode: AutomationControlMode =
      settings.controlMode || AUTOMATION_DEFAULT_CONTROL_MODE;

    if (controlMode === "disabled" || !settings.enabled) {
      return;
    }

    const runtimeMode = whatsapp
      ? resolveWhatsappAiAgentRuntimeMode(
          whatsapp as Parameters<typeof resolveWhatsappAiAgentRuntimeMode>[0]
        )
      : "disabled";

    const ctx = buildExecutionContextFromInbound({
      companyId: input.companyId,
      channel: input.channel || "whatsapp",
      messageId: input.messageId ?? null,
      controlMode,
      ticket: ticket as Parameters<
        typeof buildExecutionContextFromInbound
      >[0]["ticket"],
      contact: {
        id: Number(input.contact.id),
        name: (input.contact.name as string) ?? null
      },
      whatsapp: whatsapp as Parameters<
        typeof buildExecutionContextFromInbound
      >[0]["whatsapp"],
      currentMessage: {
        body: input.body ?? null,
        fromMe: input.fromMe === true,
        hasText: input.hasText
      },
      integrationActive: input.integrationActive === true,
      metadata: {
        runtimeMode,
        source: "inbound_observe",
        ...(input.metadata || {})
      }
    });

    await safeStartAutomationExecution({
      companyId: input.companyId,
      channel: ctx.channel,
      messageId: ctx.messageId,
      ticketId: ctx.ticketId,
      contactId: ctx.contactId,
      whatsappId: ctx.whatsappId,
      controlMode,
      executionContext: ctx,
      metadata: { source: "scheduleAutomationObserveFromInbound" }
    });
  } catch (err) {
    logger.warn(
      {
        err,
        companyId: input.companyId,
        ticketId: input.ticket?.id,
        messageId: input.messageId
      },
      "[AutomationOrchestrator] scheduleAutomationObserveFromInbound fail-open"
    );
  }
}

export default scheduleAutomationObserveFromInbound;
