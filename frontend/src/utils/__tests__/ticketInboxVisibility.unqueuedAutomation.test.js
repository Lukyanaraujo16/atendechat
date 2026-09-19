import {
  decideUserTicketInboxVisibility,
  canUserViewTicketInInbox
} from "../ticketInboxVisibility";
import { isUnqueuedPendingAutomationTicket } from "../ticketAutomationUi";

const user = {
  id: 10,
  profile: "user",
  companyId: 1,
  allTicket: "disabled",
  queues: [{ id: 4 }, { id: 7 }]
};

function ticket(partial = {}) {
  return {
    id: 77,
    companyId: 1,
    status: "pending",
    isGroup: false,
    userId: null,
    queueId: null,
    chatbot: true,
    ...partial
  };
}

describe("unqueued automation AUTO visibility", () => {
  it("pending chatbot sem fila aparece em AUTO para usuário da empresa", () => {
    const t = ticket();
    expect(isUnqueuedPendingAutomationTicket(t)).toBe(true);
    const decision = decideUserTicketInboxVisibility(user, t, []);
    expect(decision).toEqual({
      allowed: true,
      reason: "unqueued_automation"
    });
    expect(canUserViewTicketInInbox(user, t, [])).toBe(true);
  });

  it("órfão humano sem fila continua oculto", () => {
    const t = ticket({ chatbot: false });
    expect(isUnqueuedPendingAutomationTicket(t)).toBe(false);
    expect(decideUserTicketInboxVisibility(user, t, []).allowed).toBe(false);
    expect(decideUserTicketInboxVisibility(user, t, []).reason).toBe(
      "queue_null_denied"
    );
  });

  it("outra empresa NÃO é visível", () => {
    const t = ticket({ companyId: 99 });
    expect(decideUserTicketInboxVisibility(user, t, []).allowed).toBe(false);
    expect(decideUserTicketInboxVisibility(user, t, []).reason).toBe(
      "company_mismatch"
    );
  });

  it("grupo NÃO entra na exceção", () => {
    const t = ticket({ isGroup: true });
    expect(isUnqueuedPendingAutomationTicket(t)).toBe(false);
    expect(decideUserTicketInboxVisibility(user, t, []).allowed).toBe(false);
  });

  it("userId preenchido não é AUTO pendente", () => {
    const t = ticket({ userId: 10 });
    expect(isUnqueuedPendingAutomationTicket(t)).toBe(false);
    expect(decideUserTicketInboxVisibility(user, t, []).reason).toBe(
      "own_assigned_ticket"
    );
  });

  it("após setor sai de AUTO e entra na ACL da fila", () => {
    const t = ticket({ chatbot: false, queueId: 4 });
    expect(isUnqueuedPendingAutomationTicket(t)).toBe(false);
    expect(decideUserTicketInboxVisibility(user, t, []).reason).toBe(
      "queue_allowed"
    );
  });

  it("automationActive true também conta na UI", () => {
    const t = ticket({
      chatbot: false,
      automationActive: true
    });
    expect(isUnqueuedPendingAutomationTicket(t)).toBe(true);
    expect(decideUserTicketInboxVisibility(user, t, []).reason).toBe(
      "unqueued_automation"
    );
  });
});
