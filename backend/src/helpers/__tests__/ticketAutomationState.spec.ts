import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import {
  isTicketAiAgentAutomationCandidate,
  isTicketInAutomationsColumn,
  resolveTicketAutomationState
} from "../ticketAutomationState";

function ticket(partial: Partial<Ticket>): Ticket {
  return partial as Ticket;
}

function whatsapp(
  partial: Partial<Whatsapp>
): Pick<Whatsapp, "aiAgentMode" | "aiAgentId" | "aiAgentEnabled"> {
  return partial as Whatsapp;
}

describe("ticketAutomationState", () => {
  describe("resolveTicketAutomationState", () => {
    it("identifica chatbot tradicional", () => {
      const state = resolveTicketAutomationState({
        ticket: ticket({ status: "pending", chatbot: true, userId: null }),
        whatsapp: whatsapp({ aiAgentMode: "disabled", aiAgentId: null })
      });
      expect(state.automationActive).toBe(true);
      expect(state.automationType).toBe("chatbot");
      expect(state.automationLabel).toBe("Chatbot");
    });

    it("identifica IA ativa em live mode", () => {
      const state = resolveTicketAutomationState({
        ticket: ticket({
          status: "pending",
          chatbot: false,
          userId: null,
          aiAgentPaused: false
        }),
        whatsapp: whatsapp({
          aiAgentMode: "live",
          aiAgentId: 7,
          aiAgentEnabled: true
        }),
        aiAgentName: "Suporte IA",
        hasAiAgentOutboundMessage: true
      });
      expect(state.automationActive).toBe(true);
      expect(state.automationType).toBe("ai_agent");
      expect(state.automationLabel).toBe("IA atendendo");
      expect(state.aiAgentActive).toBe(true);
      expect(state.aiAgentName).toBe("Suporte IA");
    });

    it("IA pausada retorna label sem automação ativa", () => {
      const state = resolveTicketAutomationState({
        ticket: ticket({
          status: "pending",
          userId: null,
          aiAgentPaused: true
        }),
        whatsapp: whatsapp({
          aiAgentMode: "live",
          aiAgentId: 7,
          aiAgentEnabled: true
        }),
        hasAiAgentOutboundMessage: true
      });
      expect(state.automationActive).toBe(false);
      expect(state.automationLabel).toBe("IA pausada");
      expect(state.aiAgentPaused).toBe(true);
    });

    it("ticket com humano não é automação", () => {
      const state = resolveTicketAutomationState({
        ticket: ticket({
          status: "open",
          userId: 12,
          chatbot: true
        }),
        whatsapp: whatsapp({ aiAgentMode: "live", aiAgentId: 1 })
      });
      expect(state.automationActive).toBe(false);
      expect(state.reason).toBe("human_assigned");
    });

    it("ticket sem automação permanece none", () => {
      const state = resolveTicketAutomationState({
        ticket: ticket({ status: "pending", userId: null, chatbot: false }),
        whatsapp: whatsapp({ aiAgentMode: "disabled", aiAgentId: null })
      });
      expect(state.automationActive).toBe(false);
      expect(state.reason).toBe("none");
    });

    it("flowbuilder ativo dentro de chatbot", () => {
      const state = resolveTicketAutomationState({
        ticket: ticket({
          status: "pending",
          chatbot: true,
          flowWebhook: true,
          flowStopped: "42"
        }),
        whatsapp: whatsapp({ aiAgentMode: "disabled", aiAgentId: null })
      });
      expect(state.automationActive).toBe(true);
      expect(state.automationType).toBe("flowbuilder");
      expect(state.automationLabel).toBe("Fluxo");
    });

    it("IA com handoff solicitado exibe Precisa humano", () => {
      const state = resolveTicketAutomationState({
        ticket: ticket({
          status: "pending",
          userId: null,
          aiAgentPaused: true,
          aiAgentHandoffRequested: true,
          aiAgentHandoffReason: "model_requested_handoff"
        }),
        whatsapp: whatsapp({
          aiAgentMode: "live",
          aiAgentId: 7,
          aiAgentEnabled: true
        }),
        hasAiAgentOutboundMessage: true
      });
      expect(state.automationActive).toBe(false);
      expect(state.automationLabel).toBe("Precisa humano");
      expect(state.aiAgentHandoffRequested).toBe(true);
      expect(state.reason).toBe("ai_handoff");
    });
  });

  describe("isTicketAiAgentAutomationCandidate", () => {
    it("rejeita ticket com userId", () => {
      expect(
        isTicketAiAgentAutomationCandidate(
          ticket({ userId: 1, status: "pending", isGroup: false }),
          whatsapp({ aiAgentMode: "live", aiAgentId: 1 })
        )
      ).toBe(false);
    });

    it("aceita candidato live sem pausa", () => {
      expect(
        isTicketAiAgentAutomationCandidate(
          ticket({
            userId: null,
            status: "pending",
            isGroup: false,
            aiAgentPaused: false
          }),
          whatsapp({ aiAgentMode: "live", aiAgentId: 3, aiAgentEnabled: true })
        )
      ).toBe(true);
    });
  });

  describe("isTicketInAutomationsColumn", () => {
    it("inclui chatbot e IA com evidência", () => {
      expect(
        isTicketInAutomationsColumn({
          ticket: ticket({ status: "pending", chatbot: true, userId: null }),
          whatsapp: whatsapp({ aiAgentMode: "disabled", aiAgentId: null })
        })
      ).toBe(true);

      expect(
        isTicketInAutomationsColumn({
          ticket: ticket({
            status: "pending",
            chatbot: false,
            userId: null,
            aiAgentPaused: false
          }),
          whatsapp: whatsapp({
            aiAgentMode: "live",
            aiAgentId: 2,
            aiAgentEnabled: true
          }),
          hasLiveRuntimeActivity: true
        })
      ).toBe(true);
    });

    it("exclui IA sem evidência", () => {
      expect(
        isTicketInAutomationsColumn({
          ticket: ticket({
            status: "pending",
            chatbot: false,
            userId: null,
            aiAgentPaused: false
          }),
          whatsapp: whatsapp({
            aiAgentMode: "live",
            aiAgentId: 2,
            aiAgentEnabled: true
          }),
          hasAiAgentOutboundMessage: false,
          hasLiveRuntimeActivity: false
        })
      ).toBe(false);
    });
  });
});
