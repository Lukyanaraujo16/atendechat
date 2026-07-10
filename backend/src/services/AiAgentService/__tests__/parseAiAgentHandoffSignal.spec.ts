import {
  AI_AGENT_HANDOFF_MARKER,
  parseAiAgentHandoffSignal
} from "../parseAiAgentHandoffSignal";

describe("parseAiAgentHandoffSignal", () => {
  it("mantém resposta sem marcador", () => {
    const result = parseAiAgentHandoffSignal("Olá! Como posso ajudar?");
    expect(result.handoffRequested).toBe(false);
    expect(result.cleanText).toBe("Olá! Como posso ajudar?");
    expect(result.handoffReason).toBeNull();
  });

  it("remove marcador em linha separada", () => {
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

  it("detecta marcador com espaços extras", () => {
    const result = parseAiAgentHandoffSignal(
      "Mensagem ao cliente\n  [HANDOFF_HUMAN]  "
    );
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe("Mensagem ao cliente");
  });

  it("resposta vazia após remover marcador", () => {
    const result = parseAiAgentHandoffSignal("[HANDOFF_HUMAN]");
    expect(result.handoffRequested).toBe(true);
    expect(result.cleanText).toBe("");
  });
});
