import {
  AI_AGENT_HANDOFF_MARKER,
  containsKnownAiAgentHandoffMarker,
  parseAiAgentHandoffSignal,
  stripKnownAiAgentHandoffMarkers
} from "../parseAiAgentHandoffSignal";

const REAL_E2E_FIM_HUMAN = `Olá, Lukyan! Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá ajudar com suas dúvidas.

[FIM_HUMAN]`;

const REAL_E2E_CLEAN =
  "Olá, Lukyan! Vou encaminhar seu atendimento para outro atendente da nossa equipe, que poderá ajudar com suas dúvidas.";

describe("parseAiAgentHandoffSignal", () => {
  it("mantém resposta sem marcador", () => {
    const result = parseAiAgentHandoffSignal("Olá! Como posso ajudar?");
    expect(result.handoffRequested).toBe(false);
    expect(result.cleanText).toBe("Olá! Como posso ajudar?");
    expect(result.handoffReason).toBeNull();
  });

  it("remove [HANDOFF_HUMAN] em linha separada", () => {
    const result = parseAiAgentHandoffSignal(
      "Vou deixar seu atendimento disponível para um atendente.\n[HANDOFF_HUMAN]"
    );
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe(
      "Vou deixar seu atendimento disponível para um atendente."
    );
    expect(result.handoffReason).toBe("model_requested_handoff");
    expect(result.cleanText).not.toContain(AI_AGENT_HANDOFF_MARKER);
  });

  it("reconhece alias [FIM_HUMANO]", () => {
    const result = parseAiAgentHandoffSignal(
      "Vou encaminhar seu atendimento para outro atendente da equipe.\n[FIM_HUMANO]"
    );
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe(
      "Vou encaminhar seu atendimento para outro atendente da equipe."
    );
    expect(result.cleanText).not.toContain("[FIM_HUMANO]");
    expect(result.cleanText).not.toContain("[HANDOFF_HUMAN]");
  });

  it("é case-insensitive para canônico e alias", () => {
    expect(parseAiAgentHandoffSignal("[handoff_human]").handoffRequested).toBe(
      true
    );
    expect(parseAiAgentHandoffSignal("[fim_humano]").handoffRequested).toBe(
      true
    );
    expect(parseAiAgentHandoffSignal("[Fim_Humano]").cleanText).toBe("");
  });

  it("detecta marcador com espaços extras", () => {
    const result = parseAiAgentHandoffSignal(
      "Mensagem ao cliente\n  [ HANDOFF_HUMAN ]  "
    );
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe("Mensagem ao cliente");
  });

  it("remove markdown simples envolvendo o marcador", () => {
    const result = parseAiAgentHandoffSignal(
      "Texto útil.\n**[HANDOFF_HUMAN]**"
    );
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe("Texto útil.");
    expect(result.cleanText).not.toContain("HANDOFF_HUMAN");
  });

  it("preserva texto antes e depois do marcador", () => {
    const result = parseAiAgentHandoffSignal(
      "Antes do protocolo [FIM_HUMANO] depois do protocolo"
    );
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe("Antes do protocolo depois do protocolo");
  });

  it("remove mais de uma ocorrência conhecida", () => {
    const result = parseAiAgentHandoffSignal(
      "[HANDOFF_HUMAN]\nParágrafo.\n[FIM_HUMANO]"
    );
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe("Parágrafo.");
    expect(result.cleanText).not.toMatch(/HANDOFF_HUMAN|FIM_HUMANO/i);
  });

  it("resposta vazia após remover marcador", () => {
    const result = parseAiAgentHandoffSignal("[HANDOFF_HUMAN]");
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe("");
  });

  it("frase de encaminhamento sem marcador NÃO dispara handoff", () => {
    const result = parseAiAgentHandoffSignal(
      "Vou encaminhar para um atendente da equipe."
    );
    expect(result.handoffRequested).toBe(false);
    expect(result.cleanText).toBe(
      "Vou encaminhar para um atendente da equipe."
    );
  });

  it("conteúdo arbitrário [EXEMPLO] não é removido", () => {
    const result = parseAiAgentHandoffSignal(
      "Veja o código [EXEMPLO] na documentação."
    );
    expect(result.handoffRequested).toBe(false);
    expect(result.cleanText).toBe("Veja o código [EXEMPLO] na documentação.");
  });

  it("não trata [INAUDIVEL] como handoff", () => {
    const result = parseAiAgentHandoffSignal("Áudio [INAUDIVEL] recebido.");
    expect(result.handoffRequested).toBe(false);
    expect(result.cleanText).toBe("Áudio [INAUDIVEL] recebido.");
  });

  it("reconhece o alias real E2E [FIM_HUMAN]", () => {
    const result = parseAiAgentHandoffSignal(REAL_E2E_FIM_HUMAN);
    expect(result.handoffRequested).toBe(true);
    expect(result.handoffReason).toBe("model_requested_handoff");
    expect(result.cleanText).toBe(REAL_E2E_CLEAN);
    expect(result.cleanText).not.toMatch(/FIM_HUMAN/i);
    expect(result.cleanText).not.toContain("[FIM_HUMAN]");
  });

  it("não trata palavras comuns sem protocolo como handoff", () => {
    const phrases = [
      "O atendimento humano segue normalmente.",
      "Fale com um atendente humano se preferir.",
      "Chegamos ao fim da conversa.",
      "This is a human question."
    ];
    phrases.forEach(phrase => {
      const result = parseAiAgentHandoffSignal(phrase);
      expect(result.handoffRequested).toBe(false);
      expect(result.cleanText).toBe(phrase);
    });
  });
});

describe("stripKnownAiAgentHandoffMarkers", () => {
  it("é sanitização sem semântica extra", () => {
    expect(stripKnownAiAgentHandoffMarkers("Olá [FIM_HUMANO]")).toBe("Olá");
    expect(stripKnownAiAgentHandoffMarkers("Olá [EXEMPLO]")).toBe(
      "Olá [EXEMPLO]"
    );
  });

  it("remove o alias real E2E [FIM_HUMAN] e preserva a frase", () => {
    const stripped = stripKnownAiAgentHandoffMarkers(REAL_E2E_FIM_HUMAN);
    expect(stripped).toBe(REAL_E2E_CLEAN);
    expect(stripped).not.toMatch(/FIM_HUMAN/i);
  });
});

describe("containsKnownAiAgentHandoffMarker", () => {
  it("reconhece [FIM_HUMAN] do E2E real", () => {
    expect(containsKnownAiAgentHandoffMarker(REAL_E2E_FIM_HUMAN)).toBe(true);
  });

  it("não reconhece texto sem protocolo delimitado", () => {
    expect(
      containsKnownAiAgentHandoffMarker("O atendimento humano segue.")
    ).toBe(false);
    expect(containsKnownAiAgentHandoffMarker("This is human.")).toBe(false);
  });
});
