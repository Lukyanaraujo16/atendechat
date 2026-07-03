import Ticket from "../../models/Ticket";

export type FlowAutomationActiveResult = {
  active: boolean;
  reason?: string;
  evidence?: Record<string, unknown>;
};

/**
 * Semântica de `Ticket.flowStopped` (auditoria Fase IA 1.2.1):
 *
 * - O nome é enganoso: guarda o **ID do fluxo FlowBuilder** (`idFlowDb`), não um booleano.
 * - `flowWebhook === true` indica que o motor aguarda input / está em execução ativa.
 * - `flowWebhook === false` com `flowStopped` preenchido = fluxo encerrado ou pausado formalmente,
 *   mas o ID do fluxo pode permanecer no ticket (estado residual).
 * - Reset completo: `flowStopped: null`, `lastFlowId: null`, `flowWebhook: false`
 *   (ex.: reabertura em FindOrCreateTicketService).
 *
 * Portanto **não** usar `flowStopped` sozinho como sinal de fluxo ativo.
 */
export function isFlowAutomationActive(ticket: Ticket): FlowAutomationActiveResult {
  const flowStoppedRaw = ticket.flowStopped;
  const hasFlowId =
    flowStoppedRaw != null &&
    String(flowStoppedRaw).trim() !== "" &&
    String(flowStoppedRaw).trim() !== "0";

  const flowWebhook = ticket.flowWebhook === true;

  if (flowWebhook && hasFlowId) {
    return {
      active: true,
      reason: "flow_webhook_active",
      evidence: {
        flowWebhook: true,
        hasFlowId: true,
        lastFlowId: ticket.lastFlowId ?? null
      }
    };
  }

  return {
    active: false,
    evidence: {
      flowWebhook,
      hasFlowId,
      lastFlowId: ticket.lastFlowId ?? null,
      flowStoppedIsFlowIdNotStoppedFlag: true
    }
  };
}
