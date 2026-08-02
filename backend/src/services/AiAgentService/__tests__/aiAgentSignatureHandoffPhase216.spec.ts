import {
  contentAlreadyHasAiAgentSignature,
  FALLBACK_AGENT_NAME,
  formatAiAgentSignedMessage,
  resolveAiAgentPublicName,
  stripLeadingAiAgentSignature
} from "../formatAiAgentSignedMessage";
import {
  buildAiAgentHandoffTransitionMessage,
  containsForbiddenHandoffVocabulary,
  sanitizeAiAgentClientFacingText
} from "../buildAiAgentHandoffTransitionMessage";
import { buildAiAgentSystemPrompt } from "../buildAiAgentSystemPrompt";

describe("formatAiAgentSignedMessage", () => {
  it("assina resposta normal", () => {
    const out = formatAiAgentSignedMessage({
      agentName: "Eduardo",
      content: "Olá! Como posso ajudar?"
    });
    expect(out.body).toBe("Eduardo:\nOlá! Como posso ajudar?");
    expect(out.signed).toBe(true);
  });

  it("usa nome correto com acentos", () => {
    const out = formatAiAgentSignedMessage({
      agentName: "José Antônio",
      content: "Bom dia"
    });
    expect(out.body.startsWith("José Antônio:\n")).toBe(true);
  });

  it("fallback para nome vazio", () => {
    expect(resolveAiAgentPublicName("   ")).toBe(FALLBACK_AGENT_NAME);
    const out = formatAiAgentSignedMessage({
      agentName: "  ",
      content: "Oi"
    });
    expect(out.body).toBe(`${FALLBACK_AGENT_NAME}:\nOi`);
  });

  it("não duplica assinatura já presente", () => {
    const out = formatAiAgentSignedMessage({
      agentName: "Eduardo",
      content: "Eduardo:\nOlá!"
    });
    expect(out.body).toBe("Eduardo:\nOlá!");
    expect(out.deduped).toBe(true);
  });

  it("remove assinatura bold estilo WhatsApp humano", () => {
    expect(stripLeadingAiAgentSignature("*Eduardo:*\nOlá", "Eduardo")).toBe(
      "Olá"
    );
    expect(
      contentAlreadyHasAiAgentSignature("*Eduardo:*\nOlá", "Eduardo")
    ).toBe(true);
  });

  it("conteúdo vazio não assina", () => {
    const out = formatAiAgentSignedMessage({
      agentName: "Eduardo",
      content: "   "
    });
    expect(out.body).toBe("");
    expect(out.signed).toBe(false);
  });
});

describe("handoff transition vocabulary", () => {
  it("sanitiza atendente humano", () => {
    expect(
      sanitizeAiAgentClientFacingText(
        "Vou transferir para um atendente humano agora."
      )
    ).not.toMatch(/humano/i);
  });

  it("build default não contém vocabulário proibido", () => {
    ["formal", "professional", "friendly", "casual", "custom"].forEach(tone => {
      const msg = buildAiAgentHandoffTransitionMessage({
        reason: "model_requested_handoff",
        tone
      });
      expect(containsForbiddenHandoffVocabulary(msg)).toBe(false);
      expect(msg.length).toBeGreaterThan(10);
    });
  });

  it("usa handoffMessage configurada quando existir", () => {
    const msg = buildAiAgentHandoffTransitionMessage({
      configuredHandoffMessage: "Vou encaminhar você para o setor responsável.",
      tone: "professional"
    });
    expect(msg).toContain("setor responsável");
  });

  it("motivos mapeiam mensagens distintas", () => {
    const a = buildAiAgentHandoffTransitionMessage({
      reason: "low_confidence",
      tone: "professional"
    });
    const b = buildAiAgentHandoffTransitionMessage({
      reason: "client_request",
      tone: "professional"
    });
    expect(a).not.toBe(b);
  });
});

describe("system prompt identidade e handoff", () => {
  it("inclui nome público e proíbe humano", () => {
    const prompt = buildAiAgentSystemPrompt(
      { name: "Eduardo", systemPrompt: null } as never,
      null
    );
    expect(prompt).toContain("Nome público: Eduardo");
    expect(prompt).toContain("assistente virtual");
    expect(prompt).toMatch(/Nunca use as expressões/i);
    // Instruções afirmativas usam "outro atendente", não recomendam "humano"
    const beforeBan = prompt.split(/Nunca use as expressões/i)[0] ?? "";
    expect(beforeBan).toContain("outro atendente");
    expect(beforeBan).not.toMatch(/atendente humano/i);
    expect(prompt).toContain("[HANDOFF_HUMAN]");
    expect(prompt).toMatch(/não escreva o prefixo/i);
  });
});
