import {
  AI_AGENT_HANDOFF_MARKER,
  parseAiAgentHandoffSignal,
  stripKnownAiAgentHandoffMarkers
} from "../parseAiAgentHandoffSignal";

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
});

describe("stripKnownAiAgentHandoffMarkers", () => {
  it("é sanitização sem semântica extra", () => {
    expect(stripKnownAiAgentHandoffMarkers("Olá [FIM_HUMANO]")).toBe("Olá");
    expect(stripKnownAiAgentHandoffMarkers("Olá [EXEMPLO]")).toBe(
      "Olá [EXEMPLO]"
    );
  });
});
