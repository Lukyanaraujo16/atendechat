/**
 * Fase 2.20.4 — Negação falsa de visão (detector + integridade).
 */
import {
  detectAiAgentFalseMediaCapabilityDenial,
  shouldOmitAiAgentHistoryLineForVision,
  normalizeAiAgentDenialText,
  AI_AGENT_VISION_FALSE_DENIAL_FALLBACK_MESSAGE
} from "../detectAiAgentFalseMediaCapabilityDenial";
import { enforceAiAgentVisionResponseIntegrity } from "../enforceAiAgentVisionResponseIntegrity";
import { buildAiAgentPromptContext } from "../buildAiAgentPromptContext";

jest.mock("../../AiProviderService/AiProviderAdapterFactory", () => ({
  generateChatCompletionViaAdapter: jest.fn()
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

import { generateChatCompletionViaAdapter } from "../../AiProviderService/AiProviderAdapterFactory";
import Message from "../../../models/Message";
import Ticket from "../../../models/Ticket";
import Contact from "../../../models/Contact";
import AiAgent from "../../../models/AiAgent";

const mockedGenerate = generateChatCompletionViaAdapter as jest.Mock;
const mockedFindAll = Message.findAll as jest.Mock;

describe("detectAiAgentFalseMediaCapabilityDenial", () => {
  it("detecta negação genérica PT (ticket 4891)", () => {
    const r = detectAiAgentFalseMediaCapabilityDenial(
      "Desculpe, mas não consigo visualizar imagens."
    );
    expect(r.isFalseDenial).toBe(true);
  });

  it("detecta variações e inglês", () => {
    expect(
      detectAiAgentFalseMediaCapabilityDenial(
        "Não tenho capacidade de ver imagens"
      ).isFalseDenial
    ).toBe(true);
    expect(
      detectAiAgentFalseMediaCapabilityDenial(
        "Envie uma descrição da imagem em texto"
      ).isFalseDenial
    ).toBe(true);
    expect(
      detectAiAgentFalseMediaCapabilityDenial(
        "I cannot see images, please describe the image"
      ).isFalseDenial
    ).toBe(true);
  });

  it("não bloqueia limitação legítima do conteúdo", () => {
    expect(
      detectAiAgentFalseMediaCapabilityDenial(
        "Não consigo identificar claramente o texto pequeno na etiqueta."
      ).isFalseDenial
    ).toBe(false);
    expect(
      detectAiAgentFalseMediaCapabilityDenial(
        "A imagem está desfocada; não consigo confirmar a marca."
      ).isFalseDenial
    ).toBe(false);
    expect(
      detectAiAgentFalseMediaCapabilityDenial(
        "Não é possível determinar a idade da pessoa pela imagem."
      ).isFalseDenial
    ).toBe(false);
  });

  it("normaliza acentos e pontuação", () => {
    expect(normalizeAiAgentDenialText("Não, consigo!!!")).toContain(
      "nao consigo"
    );
  });

  it("omite histórico contaminado", () => {
    expect(
      shouldOmitAiAgentHistoryLineForVision(
        "Eduardo:\nNão consigo visualizar imagens."
      )
    ).toBe(true);
    expect(
      shouldOmitAiAgentHistoryLineForVision("Vi que você enviou um produto.")
    ).toBe(false);
  });
});

describe("enforceAiAgentVisionResponseIntegrity", () => {
  beforeEach(() => {
    mockedGenerate.mockReset();
  });

  it("sem imageParts não regenera", async () => {
    const out = await enforceAiAgentVisionResponseIntegrity({
      hasImageParts: false,
      text: "Desculpe, mas não consigo visualizar imagens.",
      provider: "openai",
      companyId: 1,
      ticketId: 1,
      apiKey: "sk",
      model: "gpt-4o-mini",
      maxTokens: 256,
      temperature: 0.2,
      systemPrompt: "sys",
      messages: [{ role: "user", content: "hi" }],
      timeoutMs: 5000,
      source: "test"
    });
    expect(out.meta.visionFalseDenialDetected).toBe(false);
    expect(mockedGenerate).not.toHaveBeenCalled();
    expect(out.text).toContain("não consigo visualizar");
  });

  it("com imageParts + negação → regenera e aceita resposta boa", async () => {
    mockedGenerate.mockResolvedValue({
      ok: true,
      text: "Vi um produto embalado com rótulo azul.",
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: 10
    });
    const out = await enforceAiAgentVisionResponseIntegrity({
      hasImageParts: true,
      text: "Desculpe, mas não consigo visualizar imagens.",
      provider: "openai",
      companyId: 1,
      ticketId: 4891,
      apiKey: "sk",
      model: "gpt-4o-mini",
      maxTokens: 256,
      temperature: 0.2,
      systemPrompt: "sys",
      messages: [{ role: "user", content: "analise" }],
      timeoutMs: 5000,
      source: "test",
      imageParts: [{ mimeType: "image/jpeg", base64: "AAAA" }]
    });
    expect(mockedGenerate).toHaveBeenCalledTimes(1);
    expect(out.meta.visionFalseDenialDetected).toBe(true);
    expect(out.meta.visionFalseDenialRetried).toBe(true);
    expect(out.meta.visionFalseDenialFallback).toBe(false);
    expect(out.text).toContain("produto");
  });

  it("regeneração ainda nega → fallback determinístico", async () => {
    mockedGenerate.mockResolvedValue({
      ok: true,
      text: "I cannot see images.",
      provider: "openai",
      model: "gpt-4o-mini",
      latencyMs: 10
    });
    const out = await enforceAiAgentVisionResponseIntegrity({
      hasImageParts: true,
      text: "Não consigo visualizar imagens.",
      provider: "openai",
      companyId: 1,
      ticketId: 4891,
      apiKey: "sk",
      model: "gpt-4o-mini",
      maxTokens: 256,
      temperature: 0.2,
      systemPrompt: "sys",
      messages: [{ role: "user", content: "analise" }],
      timeoutMs: 5000,
      source: "test",
      imageParts: [{ mimeType: "image/jpeg", base64: "AAAA" }]
    });
    expect(out.meta.visionFalseDenialFallback).toBe(true);
    expect(out.text).toBe(AI_AGENT_VISION_FALSE_DENIAL_FALLBACK_MESSAGE);
  });
});

describe("buildAiAgentPromptContext filtra contaminação de visão", () => {
  beforeEach(() => {
    mockedFindAll.mockReset();
  });

  it("remove respostas anteriores de incapacidade visual do histórico", async () => {
    mockedFindAll.mockResolvedValue([
      {
        body: "Desculpe, mas não consigo visualizar imagens.",
        fromMe: true,
        mediaType: "conversation",
        createdAt: new Date()
      },
      {
        body: "Olá",
        fromMe: false,
        mediaType: "conversation",
        createdAt: new Date()
      }
    ]);

    const ctx = await buildAiAgentPromptContext({
      companyId: 1,
      ticket: { id: 4891, queueId: null, status: "pending" } as Ticket,
      contact: { name: "Cliente" } as Contact,
      agent: { id: 1 } as AiAgent,
      currentInboundText: "o que é isso?"
    });

    expect(ctx.messages[0].content).not.toContain(
      "não consigo visualizar imagens"
    );
    expect(ctx.messages[0].content).toContain("Cliente: Olá");
  });
});
