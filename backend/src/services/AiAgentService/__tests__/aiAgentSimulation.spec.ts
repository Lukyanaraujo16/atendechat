jest.mock("../../../models/AiAgent", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));

jest.mock("../../../models/AiAgentSimulationSession", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    count: jest.fn()
  }
}));

jest.mock("../../../models/AiAgentSimulationMessage", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findAll: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn()
  }
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));

jest.mock("../sendAiAgentWhatsappMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../AiProviderService/AiProviderAdapterFactory", () => ({
  generateChatCompletionViaAdapter: jest.fn()
}));

jest.mock("../resolveAiAgentApiCredential", () => ({
  resolveAiAgentApiCredentialForSimulation: jest.fn()
}));

jest.mock("../resolveAiAgentBusinessPrompt", () => ({
  ...jest.requireActual("../resolveAiAgentBusinessPrompt"),
  loadAiAgentProfileForRuntime: jest.fn()
}));

import AiAgent from "../../../models/AiAgent";
import AiAgentSimulationSession from "../../../models/AiAgentSimulationSession";
import AiAgentSimulationMessage from "../../../models/AiAgentSimulationMessage";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import Message from "../../../models/Message";
import sendAiAgentWhatsappMessage from "../sendAiAgentWhatsappMessage";
import { generateChatCompletionViaAdapter } from "../../AiProviderService/AiProviderAdapterFactory";
import { resolveAiAgentApiCredentialForSimulation } from "../resolveAiAgentApiCredential";
import { loadAiAgentProfileForRuntime } from "../resolveAiAgentBusinessPrompt";
import { buildAiAgentSystemPrompt } from "../buildAiAgentSystemPrompt";
import { buildSimulationContextMessages } from "../buildSimulationContextMessages";
import { parseAiAgentHandoffSignal } from "../parseAiAgentHandoffSignal";
import {
  createAiAgentSimulationSession,
  sendAiAgentSimulationMessage
} from "../AiAgentSimulationService";
import { AI_AGENT_SIMULATOR_SOURCE } from "../aiAgentSimulatorConfig";

const mockedAdapter = generateChatCompletionViaAdapter as jest.Mock;
const mockedCredential = resolveAiAgentApiCredentialForSimulation as jest.Mock;
const mockedProfile = loadAiAgentProfileForRuntime as jest.Mock;

function agent(partial: Record<string, unknown>) {
  return partial as unknown as import("../../../models/AiAgent").default;
}

function session(partial: Record<string, unknown>) {
  return partial as unknown as import("../../../models/AiAgentSimulationSession").default;
}

describe("AiAgent simulation 1.5.1D", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AiAgent.findOne as jest.Mock).mockResolvedValue(
      agent({
        id: 10,
        companyId: 1,
        model: "gpt-4o-mini",
        temperature: 0.4,
        maxTokens: 256,
        systemPrompt: "Prompt manual.",
        aiProviderCredentialId: 5
      })
    );
    mockedCredential.mockResolvedValue({
      apiKey: "test-key",
      provider: "openai",
      source: "agent_credential",
      credentialId: 5
    });
    mockedProfile.mockResolvedValue({
      setupMode: "guided",
      generatedPrompt: "Prompt guiado da empresa."
    });
    (AiAgentSimulationSession.count as jest.Mock).mockResolvedValue(0);
    (AiAgentSimulationSession.create as jest.Mock).mockImplementation(async (data) =>
      session({
        id: 99,
        ...data,
        update: jest.fn().mockResolvedValue(undefined)
      })
    );
  });

  it("cria sessão para agente da empresa", async () => {
    const created = await createAiAgentSimulationSession({
      companyId: 1,
      aiAgentId: 10,
      createdBy: 7
    });
    expect(created.id).toBe(99);
    expect(AiAgentSimulationSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 1,
        aiAgentId: 10,
        createdBy: 7,
        status: "active",
        provider: "openai"
      })
    );
  });

  it("empresa A não acessa agente da B", async () => {
    (AiAgent.findOne as jest.Mock).mockResolvedValue(null);
    await expect(
      createAiAgentSimulationSession({
        companyId: 2,
        aiAgentId: 10,
        createdBy: 7
      })
    ).rejects.toMatchObject({ message: "ERR_AI_AGENT_NOT_FOUND" });
  });

  it("simulação guided usa generatedPrompt no system prompt", () => {
    const prompt = buildAiAgentSystemPrompt(
      agent({ systemPrompt: "manual" }),
      { setupMode: "guided", generatedPrompt: "Instruções guiadas." } as never
    );
    expect(prompt).toContain("Instruções guiadas.");
  });

  it("simulação advanced usa systemPrompt", () => {
    const prompt = buildAiAgentSystemPrompt(
      agent({ systemPrompt: "Prompt avançado." }),
      { setupMode: "advanced" } as never
    );
    expect(prompt).toContain("Prompt avançado.");
  });

  it("histórico da sessão entra no contexto", () => {
    const messages = buildSimulationContextMessages([
      { role: "user", content: "Olá" },
      { role: "assistant", content: "Oi!" },
      { role: "user", content: "Quero saber mais" }
    ]);
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "Olá" });
  });

  it("marcador de handoff é removido e handoffSuggested é detectado", () => {
    const parsed = parseAiAgentHandoffSignal("Vou encaminhar você.\n[HANDOFF_HUMAN]");
    expect(parsed.cleanText).not.toContain("[HANDOFF_HUMAN]");
    expect(parsed.handoffRequested).toBe(true);
  });

  it("não cria Ticket, Contact, Message operacional nem envia WhatsApp", async () => {
    (AiAgentSimulationSession.findOne as jest.Mock).mockResolvedValue(
      session({
        id: 99,
        companyId: 1,
        aiAgentId: 10,
        status: "active",
        messageCount: 0,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        totalLatencyMs: 0,
        provider: "openai",
        model: "gpt-4o-mini",
        update: jest.fn().mockResolvedValue(undefined)
      })
    );
    (AiAgentSimulationMessage.count as jest.Mock).mockResolvedValue(0);
    (AiAgentSimulationMessage.findAll as jest.Mock).mockResolvedValue([]);
    (AiAgentSimulationMessage.create as jest.Mock)
      .mockResolvedValueOnce({ id: 1, role: "user", content: "Olá", createdAt: new Date() })
      .mockResolvedValueOnce({
        id: 2,
        role: "assistant",
        content: "Olá, como posso ajudar?",
        provider: "openai",
        model: "gpt-4o-mini",
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
        latencyMs: 120,
        handoffSuggested: false,
        handoffReason: null,
        createdAt: new Date()
      });
    mockedAdapter.mockResolvedValue({
      ok: true,
      text: "Olá, como posso ajudar?",
      provider: "openai",
      model: "gpt-4o-mini",
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
      latencyMs: 120
    });

    await sendAiAgentSimulationMessage({
      companyId: 1,
      aiAgentId: 10,
      sessionId: 99,
      content: "Olá"
    });

    expect(Ticket.create).not.toHaveBeenCalled();
    expect(Contact.create).not.toHaveBeenCalled();
    expect(Message.create).not.toHaveBeenCalled();
    expect(sendAiAgentWhatsappMessage).not.toHaveBeenCalled();
    expect(mockedAdapter).toHaveBeenCalledWith(
      expect.objectContaining({ source: AI_AGENT_SIMULATOR_SOURCE })
    );
  });

  it("mensagem longa é rejeitada", async () => {
    (AiAgentSimulationSession.findOne as jest.Mock).mockResolvedValue(
      session({
        id: 99,
        companyId: 1,
        aiAgentId: 10,
        status: "active",
        messageCount: 0
      })
    );
    await expect(
      sendAiAgentSimulationMessage({
        companyId: 1,
        aiAgentId: 10,
        sessionId: 99,
        content: "x".repeat(4001)
      })
    ).rejects.toMatchObject({ message: "ERR_VALIDATION_ERROR" });
  });

  it("credencial ausente bloqueia criação de sessão", async () => {
    mockedCredential.mockResolvedValue({
      apiKey: null,
      provider: null,
      source: "missing"
    });
    await expect(
      createAiAgentSimulationSession({
        companyId: 1,
        aiAgentId: 10,
        createdBy: 7
      })
    ).rejects.toMatchObject({ message: "ERR_AI_AGENT_SIMULATOR_MISSING_CREDENTIAL" });
  });
});
