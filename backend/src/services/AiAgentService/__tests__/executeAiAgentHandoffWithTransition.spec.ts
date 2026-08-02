import executeAiAgentHandoffWithTransition from "../executeAiAgentHandoffWithTransition";

import sendAiAgentWhatsappMessage from "../sendAiAgentWhatsappMessage";
import applyAiAgentHandoffToTicket from "../applyAiAgentHandoffToTicket";

jest.mock("../sendAiAgentWhatsappMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../applyAiAgentHandoffToTicket", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined)
}));

const sendMock = sendAiAgentWhatsappMessage as jest.Mock;
const handoffMock = applyAiAgentHandoffToTicket as jest.Mock;

describe("executeAiAgentHandoffWithTransition", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("envia mensagem assinada antes de transferir", async () => {
    sendMock.mockResolvedValue({ ok: true, messageId: "m1", bodySent: "x" });
    const ticket = {
      id: 10,
      aiAgentHandoffRequested: false
    } as never;

    const result = await executeAiAgentHandoffWithTransition({
      ticket,
      companyId: 1,
      aiAgentId: 7,
      agentName: "Eduardo",
      aiAgentRuntimeLogId: 99,
      reason: "model_requested_handoff",
      tone: "professional"
    });

    expect(result.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const body = sendMock.mock.calls[0][0].body as string;
    expect(body.startsWith("Eduardo:\n")).toBe(true);
    expect(body.toLowerCase()).not.toMatch(/humano/);
    expect(handoffMock).toHaveBeenCalledTimes(1);
    expect(handoffMock.mock.invocationCallOrder[0]).toBeGreaterThan(
      sendMock.mock.invocationCallOrder[0]
    );
  });

  it("falha de envio bloqueia handoff", async () => {
    sendMock.mockResolvedValue({ ok: false, error: "network" });
    const ticket = {
      id: 11,
      aiAgentHandoffRequested: false
    } as never;

    const result = await executeAiAgentHandoffWithTransition({
      ticket,
      companyId: 1,
      aiAgentId: 7,
      agentName: "Eduardo",
      aiAgentRuntimeLogId: 99,
      reason: "knowledge_missing"
    });

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.blockedHandoff).toBe(true);
      expect(result.transitionSent).toBe(false);
    }
    expect(handoffMock).not.toHaveBeenCalled();
  });

  it("idempotente se handoff já solicitado", async () => {
    const ticket = {
      id: 12,
      aiAgentHandoffRequested: true
    } as never;
    const result = await executeAiAgentHandoffWithTransition({
      ticket,
      companyId: 1,
      aiAgentId: 7,
      agentName: "Eduardo",
      aiAgentRuntimeLogId: 99,
      reason: "model_requested_handoff"
    });
    expect(result.ok).toBe(true);
    expect(sendMock).not.toHaveBeenCalled();
    expect(handoffMock).not.toHaveBeenCalled();
  });
});
