/* eslint-disable import/first */
const sendWhatsApp = jest.fn();
jest.mock("../../WbotServices/SendWhatsAppMessage", () => ({
  __esModule: true,
  default: (...a: unknown[]) => sendWhatsApp(...a)
}));

const createMessage = jest.fn();
jest.mock("../../MessageServices/CreateMessageService", () => ({
  __esModule: true,
  default: (...a: unknown[]) => createMessage(...a)
}));

jest.mock("../../../helpers/Mustache", () => ({
  __esModule: true,
  default: (body: string) => body
}));

jest.mock("../../../utils/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import sendAiAgentWhatsappMessage from "../sendAiAgentWhatsappMessage";

function ticket() {
  return {
    id: 11,
    contactId: 7,
    whatsappId: 3,
    contact: { name: "Lukyan" },
    update: jest.fn().mockResolvedValue(undefined)
  };
}

describe("sendAiAgentWhatsappMessage — defesa outbound de marcadores", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendWhatsApp.mockResolvedValue({
      key: { id: "OUT-1", remoteJid: "5511@s.whatsapp.net" },
      status: 1
    });
    createMessage.mockResolvedValue({ id: "OUT-1" });
  });

  it("remove [HANDOFF_HUMAN] antes de SendWhatsAppMessage e persistência", async () => {
    const t = ticket();
    const result = await sendAiAgentWhatsappMessage({
      ticket: t as never,
      body: "Segue o resumo.\n[HANDOFF_HUMAN]",
      companyId: 1,
      aiAgentId: 9,
      aiAgentRuntimeLogId: 15,
      agentName: "Teste Evolution Shadow"
    });

    expect(result.ok).toBe(true);
    const outbound = sendWhatsApp.mock.calls[0][0].body as string;
    expect(outbound).not.toMatch(/HANDOFF_HUMAN/i);
    expect(outbound).toContain("Segue o resumo.");
    expect(createMessage.mock.calls[0][0].messageData.body).not.toMatch(
      /HANDOFF_HUMAN/i
    );
  });

  it("remove [FIM_HUMANO] do payload e do Message.body", async () => {
    const t = ticket();
    await sendAiAgentWhatsappMessage({
      ticket: t as never,
      body: "Vou encaminhar seu atendimento.\n[FIM_HUMANO]",
      companyId: 1,
      aiAgentId: 9,
      aiAgentRuntimeLogId: 15,
      agentName: "Teste Evolution Shadow"
    });

    const outbound = sendWhatsApp.mock.calls[0][0].body as string;
    const persisted = createMessage.mock.calls[0][0].messageData.body as string;
    expect(outbound).not.toMatch(/FIM_HUMANO/i);
    expect(persisted).not.toMatch(/FIM_HUMANO/i);
    expect(persisted).not.toMatch(/HANDOFF_HUMAN/i);
  });

  it("caminho alreadySigned também remove o token sem reassinar", async () => {
    const t = ticket();
    const result = await sendAiAgentWhatsappMessage({
      ticket: t as never,
      body: "Teste Evolution Shadow:\nResumo útil.\n[FIM_HUMANO]",
      companyId: 1,
      aiAgentId: 9,
      aiAgentRuntimeLogId: 15,
      agentName: "Teste Evolution Shadow",
      alreadySigned: true
    });

    expect(result.ok).toBe(true);
    const outbound = sendWhatsApp.mock.calls[0][0].body as string;
    expect(outbound.startsWith("Teste Evolution Shadow:")).toBe(true);
    expect(outbound).not.toMatch(/FIM_HUMANO/i);
    expect((outbound.match(/Teste Evolution Shadow:/g) || []).length).toBe(1);
  });

  it("remove o alias real E2E [FIM_HUMAN] do outbound e do Message.body", async () => {
    const t = ticket();
    const result = await sendAiAgentWhatsappMessage({
      ticket: t as never,
      body: `Olá, Lukyan! Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá ajudar com suas dúvidas.

[FIM_HUMAN]`,
      companyId: 1,
      aiAgentId: 9,
      aiAgentRuntimeLogId: 20,
      agentName: "Teste Evolution Shadow"
    });

    expect(result.ok).toBe(true);
    const outbound = sendWhatsApp.mock.calls[0][0].body as string;
    const persisted = createMessage.mock.calls[0][0].messageData.body as string;
    expect(outbound).toBe(
      "Teste Evolution Shadow:\nOlá, Lukyan! Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá ajudar com suas dúvidas."
    );
    expect(outbound).not.toMatch(/FIM_HUMAN/i);
    expect(persisted).not.toMatch(/FIM_HUMAN/i);
    expect((outbound.match(/Teste Evolution Shadow:/g) || []).length).toBe(1);
  });

  it("alreadySigned com [FIM_HUMAN] remove o token sem reassinar", async () => {
    const t = ticket();
    const result = await sendAiAgentWhatsappMessage({
      ticket: t as never,
      body: `Teste Evolution Shadow:
Olá, Lukyan! Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá ajudar com suas dúvidas.

[FIM_HUMAN]`,
      companyId: 1,
      aiAgentId: 9,
      aiAgentRuntimeLogId: 20,
      agentName: "Teste Evolution Shadow",
      alreadySigned: true
    });

    expect(result.ok).toBe(true);
    const outbound = sendWhatsApp.mock.calls[0][0].body as string;
    const persisted = createMessage.mock.calls[0][0].messageData.body as string;
    expect(outbound.startsWith("Teste Evolution Shadow:")).toBe(true);
    expect(outbound).toContain(
      "Olá, Lukyan! Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá ajudar com suas dúvidas."
    );
    expect(outbound).not.toMatch(/FIM_HUMAN/i);
    expect(persisted).not.toMatch(/FIM_HUMAN/i);
    expect((outbound.match(/Teste Evolution Shadow:/g) || []).length).toBe(1);
  });

  it("texto normal permanece igual, salvo assinatura", async () => {
    const t = ticket();
    await sendAiAgentWhatsappMessage({
      ticket: t as never,
      body: "A StreamHUB centraliza conversas.",
      companyId: 1,
      aiAgentId: 9,
      aiAgentRuntimeLogId: 15,
      agentName: "Teste Evolution Shadow"
    });

    expect(sendWhatsApp.mock.calls[0][0].body).toBe(
      "Teste Evolution Shadow:\nA StreamHUB centraliza conversas."
    );
  });
});
